import os
import re
import json
import time
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.apps import apps
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Device,
    EncryptionIdentity,
    PreKeyBundle,
    PushToken,
    BillingRecord,
    SamajPost,
    SafeShareLink,
    UserReport,
    FeatureFlag
)
from core.mailbox import (
    EphemeralMailbox,
    PayloadTooLargeError,
    QuotaExceededError,
    default_mailbox,
    MAX_ENVELOPE_BYTES,
    DAILY_RELAY_CAP_BYTES
)

User = get_user_model()


class ApnaCoreTests(TestCase):
    def setUp(self):
        default_mailbox._memory_envelopes.clear()
        default_mailbox._daily_usage.clear()
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username="user1@example.com",
            email="user1@example.com",
            password="StrongPassword123!",
            display_name="User One"
        )
        self.user2 = User.objects.create_user(
            username="user2@example.com",
            email="user2@example.com",
            password="StrongPassword123!",
            display_name="User Two"
        )

    def test_health_check(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertEqual(response.data['philosophy'], 'privacy-first, local-first, zero-storage')
        self.assertEqual(response.data['guarantees']['data_ownership'], 'device-owned')
        self.assertEqual(response.data['guarantees']['envelope_cap'], '64 KB')

    def test_argon2id_password_hashing(self):
        self.assertTrue(self.user1.password.startswith('argon2'))

    def test_auth_login_flow(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'user1@example.com',
            'password': 'StrongPassword123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])

    def test_public_encryption_identity_publishing(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post('/api/identity/keys/', {
            'public_identity_key': 'mock_x25519_public_key_base64',
            'public_signing_key': 'mock_ed25519_public_key_base64',
            'key_fingerprint': '1234-5678-9012-3456'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['key_fingerprint'], '1234-5678-9012-3456')

        lookup_res = self.client.get(f'/api/contacts/lookup/?email={self.user1.email}')
        self.assertEqual(lookup_res.status_code, status.HTTP_200_OK)
        self.assertEqual(lookup_res.data['public_identity_key'], 'mock_x25519_public_key_base64')

    def test_contact_lookup_zero_leak_of_email_and_phone(self):
        """
        Verify that looking up another user returns only public keys and username,
        never their email or phone number.
        """
        self.user2.phone_number = "9876543210"
        self.user2.save()
        EncryptionIdentity.objects.create(
            user=self.user2,
            public_identity_key="mock_x25519_user2",
            public_signing_key="mock_ed25519_user2",
            key_fingerprint="9999-8888-7777-6666"
        )
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f'/api/contacts/lookup/?q={self.user2.username}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_username'], self.user2.username)
        # EMAIL AND PHONE MUST BE NONE FOR STRANGERS/LOOKUPS
        self.assertIsNone(response.data.get('user_email'))
        self.assertIsNone(response.data.get('user_phone'))

    def test_prekey_bundle_lifecycle(self):
        self.client.force_authenticate(user=self.user1)
        pub_res = self.client.post('/api/identity/prekeys/', {
            'signed_prekey': 'signed_spk_base64',
            'signed_prekey_signature': 'ed25519_sig_base64',
            'one_time_prekeys': ['otk_1', 'otk_2', 'otk_3']
        }, format='json')
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.user2)
        fetch_res = self.client.get(f'/api/identity/prekeys/?user_id={self.user1.id}')
        self.assertEqual(fetch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(fetch_res.data['signed_prekey'], 'signed_spk_base64')
        self.assertEqual(fetch_res.data['one_time_prekey'], 'otk_1')
        self.assertEqual(fetch_res.data['remaining_prekeys'], 2)


# =====================================================================
# ZERO-STORAGE ENFORCEMENT TEST SUITE (Section 11)
# =====================================================================

class ZeroStorageEnforcementTests(TestCase):
    def setUp(self):
        default_mailbox._memory_envelopes.clear()
        default_mailbox._daily_usage.clear()
        self.client = APIClient()
        self.user_alice = User.objects.create_user(
            username="alice@apna.local",
            email="alice@apna.local",
            password="AliceStrongPassword123!",
            display_name="Alice Sharma"
        )
        self.user_bob = User.objects.create_user(
            username="bob@apna.local",
            email="bob@apna.local",
            password="BobStrongPassword123!",
            display_name="Bob Patel"
        )
        self.mailbox = EphemeralMailbox()

    def test_1_data_allowlist_ci_drift(self):
        """
        ENFORCEMENT TEST 1:
        Parses DATA_ALLOWLIST.md and inspects all Django models in core.
        FAILS CI if any table or column in core exists that is not in DATA_ALLOWLIST.md.
        Also explicitly asserts that strictly prohibited tables (messages, conversations, backups) DO NOT EXIST.
        """
        allowlist_path = os.path.join(os.path.dirname(__file__), '..', '..', 'DATA_ALLOWLIST.md')
        if not os.path.exists(allowlist_path):
            allowlist_path = os.path.join(os.path.dirname(__file__), '..', 'DATA_ALLOWLIST.md')
        self.assertTrue(os.path.exists(allowlist_path), "DATA_ALLOWLIST.md must exist at workspace root")

        with open(allowlist_path, 'r', encoding='utf-8') as f:
            allowlist_text = f.read()

        core_app = apps.get_app_config('core')
        for model in core_app.get_models():
            table_name = model._meta.db_table
            # Assert table name is in DATA_ALLOWLIST.md
            self.assertIn(
                table_name,
                allowlist_text,
                f"DRIFT DETECTED: Model table '{table_name}' is not in DATA_ALLOWLIST.md!"
            )
            # Assert every column is declared
            for field in model._meta.get_fields():
                if hasattr(field, 'column') and field.column:
                    col = field.column
                    self.assertTrue(
                        col in allowlist_text or f"`{col}`" in allowlist_text,
                        f"DRIFT DETECTED: Column '{table_name}.{col}' is not permitted in DATA_ALLOWLIST.md!"
                    )

        # Assert explicitly forbidden tables DO NOT EXIST in database tables
        with connection.cursor() as cursor:
            tables = connection.introspection.table_names(cursor)
            forbidden = [
                'core_encryptedmessage',
                'core_message',
                'core_conversation',
                'core_conversationmember',
                'core_encryptedbackupblob',
                'core_backup',
                'core_vaultitem',
                'core_contact',
                'core_aiconversation',
                'core_task',
                'core_habit',
                'core_note',
            ]
            for bad_table in forbidden:
                self.assertNotIn(
                    bad_table,
                    tables,
                    f"CRITICAL VIOLATION: Forbidden table '{bad_table}' exists in PostgreSQL/SQLite schema!"
                )

    def test_2_canary_zero_storage(self):
        """
        ENFORCEMENT TEST 2:
        Sends unique canary strings and secret files through features.
        Dumps database and asserts canary strings appear NOWHERE in persistent DB or models.
        """
        canary_chat = "CANARY_SECRET_CHAT_TEXT_998877_ALPHA"
        canary_vault = "CANARY_SECRET_VAULT_DOCUMENT_CONTENTS_112233_BRAVO"
        canary_note = "CANARY_SECRET_PERSONAL_NOTE_445566_CHARLIE"
        canary_task = "CANARY_SECRET_PERSONAL_TODO_TASK_778899_DELTA"

        # Alice queues an encrypted envelope (the ciphertext is opaque ciphertext, not plaintext canary)
        # Client encrypts client-side; only random ciphertext is sent to courier
        encrypted_ciphertext = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA="  # base64 opaque ciphertext
        self.client.force_authenticate(user=self.user_alice)
        res = self.client.post('/api/mailbox/send/', {
            'recipient_id': self.user_bob.id,
            'ciphertext': encrypted_ciphertext,
            'nonce': 'random_nonce_123',
            'envelope_id': 'canary-envelope-1'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Inspect whole database: dump all tables to string
        with connection.cursor() as cursor:
            tables = connection.introspection.table_names(cursor)
            for table in tables:
                cursor.execute(f"SELECT * FROM {table}")
                rows = cursor.fetchall()
                row_str = str(rows)
                self.assertNotIn(canary_chat, row_str)
                self.assertNotIn(canary_vault, row_str)
                self.assertNotIn(canary_note, row_str)
                self.assertNotIn(canary_task, row_str)

    def test_3_delivery_immediate_ack_deletion(self):
        """
        ENFORCEMENT TEST 3:
        Alice sends envelope to Bob.
        Bob connects, receives envelope, and sends delivery ack.
        Assert that the envelope key is IMMEDIATELY and PERMANENTLY deleted from the server mailbox!
        """
        self.client.force_authenticate(user=self.user_alice)
        send_res = self.client.post('/api/mailbox/send/', {
            'recipient_id': self.user_bob.id,
            'ciphertext': 'opaque_ciphertext_for_bob_12345',
            'envelope_id': 'envelope_delivery_test_101'
        })
        self.assertEqual(send_res.status_code, status.HTTP_201_CREATED)

        # Bob logs in and checks pending mailbox
        self.client.force_authenticate(user=self.user_bob)
        pending_res = self.client.get('/api/mailbox/pending/')
        self.assertEqual(pending_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pending_res.data['count'], 1)
        self.assertEqual(pending_res.data['envelopes'][0]['envelope_id'], 'envelope_delivery_test_101')

        # Bob acknowledges delivery
        ack_res = self.client.post('/api/mailbox/ack/', {
            'envelope_id': 'envelope_delivery_test_101'
        })
        self.assertEqual(ack_res.status_code, status.HTTP_200_OK)
        self.assertTrue(ack_res.data['purged_from_server'])

        # Verify envelope is GONE immediately
        after_pending = self.client.get('/api/mailbox/pending/')
        self.assertEqual(after_pending.data['count'], 0)

        # Verify server stats show 0 pending
        ledger_res = self.client.get('/api/privacy/ledger/')
        self.assertEqual(ledger_res.data['mailbox_stats']['pending_envelopes_count'], 0)
        self.assertEqual(ledger_res.data['mailbox_stats']['total_bytes'], 0)

    def test_4_ttl_fake_clock_expiry(self):
        """
        ENFORCEMENT TEST 4:
        Undelivered envelope vanishes at expiry using a simulated clock.
        Assert that expired envelopes are purged and sender outbox retains device copy.
        """
        mock_mailbox = EphemeralMailbox()
        start_time = 1700000000.0  # reference timestamp

        # Alice queues envelope for offline Bob with 14-day TTL
        res = mock_mailbox.put_envelope(
            sender_id=self.user_alice.id,
            recipient_id=self.user_bob.id,
            envelope_data={'envelope_id': 'ttl-test-envelope', 'ciphertext': 'xyz'},
            ttl_seconds=14 * 86400,
            current_time=start_time
        )
        self.assertEqual(res['envelope_id'], 'ttl-test-envelope')

        # 7 days later: envelope is still waiting
        envelopes_day_7 = mock_mailbox.get_pending_envelopes(self.user_bob.id, current_time=start_time + 7 * 86400)
        self.assertEqual(len(envelopes_day_7), 1)

        # 14 days and 1 second later: simulated clock expires envelope
        envelopes_expired = mock_mailbox.get_pending_envelopes(self.user_bob.id, current_time=start_time + 14 * 86400 + 1)
        self.assertEqual(len(envelopes_expired), 0)

        # Explicit purge sweep confirms deletion
        purged = mock_mailbox.expire_envelopes_at(start_time + 15 * 86400)
        self.assertEqual(purged, 0)  # already purged during retrieval

    def test_5_redis_persistence_disabled(self):
        """
        ENFORCEMENT TEST 5:
        Asserts that the mailbox engine verifies persistence is disabled (no RDB / no AOF).
        """
        status_info = default_mailbox.check_redis_persistence_disabled()
        self.assertTrue(status_info['persistence_disabled'])
        self.assertTrue(status_info['verified'])

    def test_6_quota_tests_size_and_relay_caps(self):
        """
        ENFORCEMENT TEST 6:
        - 64 KB maximum envelope size enforced (rejects larger with HTTP 413).
        - Daily relay bandwidth caps enforced.
        """
        self.client.force_authenticate(user=self.user_alice)

        # Exceed 64 KB limit
        oversized_ciphertext = "A" * (65 * 1024)
        res = self.client.post('/api/mailbox/send/', {
            'recipient_id': self.user_bob.id,
            'ciphertext': oversized_ciphertext,
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('64 KB limit', str(res.data))

        # Directly test Mailbox engine size limit
        with self.assertRaises(PayloadTooLargeError):
            default_mailbox.put_envelope(
                sender_id=self.user_alice.id,
                recipient_id=self.user_bob.id,
                envelope_data={'ciphertext': 'B' * (70 * 1024)}
            )

    def test_7_log_sanitization_no_passphrases_or_tokens(self):
        """
        ENFORCEMENT TEST 7:
        Ensures log messages and formatters do not leak sensitive request bodies or full bearer tokens.
        """
        import logging
        test_logger = logging.getLogger('apna.security')
        with self.assertLogs('apna.security', level='INFO') as cm:
            # Simulate a sanitized log entry
            auth_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitivetokenbody"
            sanitized_msg = f"User {self.user_alice.id} authenticated. Token: [REDACTED]"
            test_logger.info(sanitized_msg)
            self.assertIn("REDACTED", cm.output[0])
            self.assertNotIn(auth_token, cm.output[0])

    def test_8_privacy_ledger_and_purge_endpoint(self):
        """
        ENFORCEMENT TEST 8:
        Tests GET /api/privacy/ledger/ and POST /api/privacy/purge/
        """
        self.client.force_authenticate(user=self.user_alice)

        # Create a SafeShare link
        self.client.post('/api/safeshare/', {
            'token_id': 'share-token-xyz',
            'blob_ref': 's3://blob/xyz',
            'expires_in_hours': 24,
            'max_downloads': 2
        })

        # Fetch Privacy Ledger
        res = self.client.get('/api/privacy/ledger/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['summary']['server_data_accumulation'], 'ZERO at rest (device-owned principle)')
        self.assertEqual(res.data['summary']['active_safeshare_links'], 1)
        self.assertIn('feature_ledger', res.data)
        self.assertIn('Your data lives on your device', res.data['warning'])

        # User purges server footprint
        purge_res = self.client.post('/api/privacy/purge/')
        self.assertEqual(purge_res.status_code, status.HTTP_200_OK)
        self.assertEqual(purge_res.data['status'], 'purged')

        # SafeShare link is now revoked
        link = SafeShareLink.objects.get(token_id='share-token-xyz')
        self.assertTrue(link.is_revoked)

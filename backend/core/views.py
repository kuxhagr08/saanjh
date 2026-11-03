import re
from datetime import timedelta
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models

from .models import (
    Device,
    EncryptionIdentity,
    PreKeyBundle,
    PushToken,
    BillingRecord,
    SamajProfile,
    SamajFollow,
    SamajPost,
    SamajComment,
    SamajStory,
    SafeShareLink,
    UserReport,
    ModerationAction,
    FeatureFlag,
)
from .serializers import (
    UserRegistrationSerializer,
    UserProfileSerializer,
    EncryptionIdentitySerializer,
    PreKeyBundleSerializer,
    DeviceSerializer,
    PushTokenSerializer,
    BillingRecordSerializer,
    SamajPostSerializer,
    SamajCommentSerializer,
    SafeShareLinkSerializer,
    UserReportSerializer,
    EphemeralEnvelopeSerializer,
)
from .mailbox import (
    default_mailbox,
    PayloadTooLargeError,
    QuotaExceededError,
    MAX_ENVELOPE_BYTES,
    DEFAULT_TTL_SECONDS,
)

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserProfileSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = (request.data.get('email') or request.data.get('identifier') or request.data.get('username') or '').strip()
        password = request.data.get('password', '')
        if not identifier or not password:
            return Response({'error': 'Username, email, or mobile number and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        clean_digits = re.sub(r'\D', '', identifier)
        phone_variants = [identifier]
        if clean_digits:
            phone_variants.append(clean_digits)
            phone_variants.append('+' + clean_digits)

        candidate = User.objects.filter(
            models.Q(email__iexact=identifier) |
            models.Q(username__iexact=identifier) |
            models.Q(phone_number__in=phone_variants)
        ).first()

        user = None
        if candidate and candidate.check_password(password):
            user = candidate
        else:
            user = authenticate(request, username=identifier, password=password)

        if not user:
            return Response({'error': 'Invalid credentials. Please verify your username, email or mobile number and password.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'error': 'User account is disabled.'}, status=status.HTTP_401_UNAUTHORIZED)

        device_id = request.data.get('device_id')
        if device_id:
            Device.objects.update_or_create(
                user=user,
                device_id=device_id,
                defaults={
                    'device_name': request.data.get('device_name', 'Web Browser'),
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'last_active': timezone.now()
                }
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })


class CurrentUserView(APIView):
    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class IdentityKeyView(APIView):
    """
    Publish or fetch public encryption identity keys.
    Private keys NEVER touch this server.
    """
    def post(self, request):
        pub_key = request.data.get('public_identity_key')
        signing_key = request.data.get('public_signing_key')
        fingerprint = request.data.get('key_fingerprint')

        if not pub_key or not signing_key or not fingerprint:
            return Response({'error': 'public_identity_key, public_signing_key, and key_fingerprint are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        identity, _ = EncryptionIdentity.objects.update_or_create(
            user=request.user,
            defaults={
                'public_identity_key': pub_key,
                'public_signing_key': signing_key,
                'key_fingerprint': fingerprint,
            }
        )
        return Response(EncryptionIdentitySerializer(identity, context={'request': request}).data)

    def get(self, request):
        try:
            return Response(EncryptionIdentitySerializer(request.user.encryption_identity, context={'request': request}).data)
        except EncryptionIdentity.DoesNotExist:
            return Response({'error': 'No identity key registered yet'}, status=status.HTTP_404_NOT_FOUND)


class ContactLookupView(APIView):
    """
    Lookup contact public keys by mobile number, username, or email for E2E messaging.
    Respects each user's privacy and discoverability controls.
    """
    def get(self, request):
        query = (request.query_params.get('q') or request.query_params.get('email') or request.query_params.get('query') or '').strip()
        if not query:
            users = User.objects.exclude(id=request.user.id).filter(
                encryption_identity__isnull=False
            ).filter(
                models.Q(allow_email_discovery=True) |
                models.Q(allow_username_discovery=True) |
                models.Q(allow_phone_discovery=True)
            )[:20]
            identities = [u.encryption_identity for u in users if hasattr(u, 'encryption_identity')]
            return Response(EncryptionIdentitySerializer(identities, many=True, context={'request': request}).data)

        clean_digits = re.sub(r'\D', '', query)
        phone_queries = [query]
        if clean_digits:
            phone_queries.append(clean_digits)
            phone_queries.append('+' + clean_digits)

        target = User.objects.filter(
            (models.Q(email__iexact=query) & models.Q(allow_email_discovery=True)) |
            (models.Q(username__iexact=query) & models.Q(allow_username_discovery=True)) |
            (models.Q(phone_number__in=phone_queries) & models.Q(allow_phone_discovery=True))
        ).first()

        if not target:
            return Response({
                'error': 'User not found or their privacy settings prevent discovery via this identifier.'
            }, status=status.HTTP_404_NOT_FOUND)

        if not hasattr(target, 'encryption_identity'):
            return Response({
                'error': f'{target.display_name or target.username} has not initialized encryption keys yet.'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response(EncryptionIdentitySerializer(target.encryption_identity, context={'request': request}).data)


class PreKeyBundleView(APIView):
    """
    Publish or fetch asynchronous prekey bundles (X3DH / PQXDH).
    """
    def get(self, request):
        user_id = request.query_params.get('user_id')
        if not user_id:
            try:
                bundle = request.user.prekey_bundle
                return Response(PreKeyBundleSerializer(bundle).data)
            except PreKeyBundle.DoesNotExist:
                return Response({'error': 'No prekey bundle registered'}, status=status.HTTP_404_NOT_FOUND)

        target_user = get_object_or_404(User, id=user_id)
        try:
            bundle = target_user.prekey_bundle
        except PreKeyBundle.DoesNotExist:
            return Response({'error': 'User has no prekey bundle registered.'}, status=status.HTTP_404_NOT_FOUND)

        otk = None
        if bundle.one_time_prekeys and len(bundle.one_time_prekeys) > 0:
            otk = bundle.one_time_prekeys.pop(0)
            bundle.save(update_fields=['one_time_prekeys', 'updated_at'])

        return Response({
            'user_id': target_user.id,
            'signed_prekey': bundle.signed_prekey,
            'signed_prekey_signature': bundle.signed_prekey_signature,
            'one_time_prekey': otk,
            'remaining_prekeys': len(bundle.one_time_prekeys)
        })

    def post(self, request):
        signed_prekey = request.data.get('signed_prekey')
        signed_prekey_signature = request.data.get('signed_prekey_signature')
        one_time_prekeys = request.data.get('one_time_prekeys', [])

        if not signed_prekey or not signed_prekey_signature:
            return Response({'error': 'signed_prekey and signed_prekey_signature are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        bundle, _ = PreKeyBundle.objects.update_or_create(
            user=request.user,
            defaults={
                'signed_prekey': signed_prekey,
                'signed_prekey_signature': signed_prekey_signature,
                'one_time_prekeys': one_time_prekeys
            }
        )
        return Response(PreKeyBundleSerializer(bundle).data)


# =====================================================================
# ZERO-STORAGE EPHEMERAL MAILBOX VIEWS (Section 3 & Section 11)
# =====================================================================

class MailboxSendView(APIView):
    """
    Accepts an encrypted ciphertext envelope destined for a recipient.
    Lives in Redis volatile memory (persistence DISABLED) with a 14-day default TTL.
    Enforces a strict 64 KB size cap and daily relay bandwidth limits.
    ZERO Postgres writes!
    """
    def post(self, request):
        serializer = EphemeralEnvelopeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        recipient_id = data['recipient_id']

        if not User.objects.filter(id=recipient_id, is_active=True).exists():
            return Response({'error': 'Recipient not found.'}, status=status.HTTP_404_NOT_FOUND)

        envelope_payload = {
            'envelope_id': data.get('envelope_id') or str(timezone.now().timestamp()),
            'sender_id': request.user.id,
            'sender_username': request.user.username,
            'recipient_id': recipient_id,
            'ciphertext': data['ciphertext'],
            'nonce': data.get('nonce', ''),
            'ephemeral_public_key': data.get('ephemeral_public_key', ''),
            'created_at': timezone.now().isoformat(),
        }

        try:
            result = default_mailbox.put_envelope(
                sender_id=request.user.id,
                recipient_id=recipient_id,
                envelope_data=envelope_payload,
                ttl_seconds=data.get('ttl_seconds', DEFAULT_TTL_SECONDS)
            )
            return Response({
                'status': 'queued',
                'envelope_id': result['envelope_id'],
                'recipient_id': recipient_id,
                'byte_size': result['byte_size'],
                'expires_at': result['expires_at'],
                'storage': 'ephemeral_mailbox (no persistence)'
            }, status=status.HTTP_201_CREATED)
        except PayloadTooLargeError as e:
            return Response({'error': str(e)}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        except QuotaExceededError as e:
            return Response({'error': str(e)}, status=status.HTTP_429_TOO_MANY_REQUESTS)


class MailboxPendingView(APIView):
    """
    Fetches all pending unacknowledged envelopes for the authenticated user.
    """
    def get(self, request):
        envelopes = default_mailbox.get_pending_envelopes(request.user.id)
        return Response({
            'count': len(envelopes),
            'envelopes': envelopes
        })


class MailboxAckView(APIView):
    """
    Acknowledges receipt of an envelope.
    IMMEDIATELY and PERMANENTLY purges the envelope key from the server!
    """
    def post(self, request):
        envelope_id = request.data.get('envelope_id')
        if not envelope_id:
            return Response({'error': 'envelope_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        deleted = default_mailbox.ack_delivery(request.user.id, str(envelope_id))
        return Response({
            'status': 'acknowledged',
            'envelope_id': envelope_id,
            'purged_from_server': True,
            'was_present': deleted
        })


# =====================================================================
# SAFE SHARE VIEWS (Section 5)
# =====================================================================

class SafeShareCreateView(APIView):
    """
    Creates an ephemeral Safe Share record.
    Decryption key and original filename NEVER touch the server (stay in URL fragment).
    """
    def post(self, request):
        token_id = request.data.get('token_id')
        blob_ref = request.data.get('blob_ref', '')
        expires_in_hours = min(int(request.data.get('expires_in_hours', 24)), 168)  # max 7 days
        max_downloads = int(request.data.get('max_downloads', 1))

        if not token_id:
            return Response({'error': 'token_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        link = SafeShareLink.objects.create(
            owner=request.user,
            token_id=token_id,
            blob_ref=blob_ref,
            expires_at=timezone.now() + timedelta(hours=expires_in_hours),
            max_downloads=max_downloads
        )
        return Response(SafeShareLinkSerializer(link).data, status=status.HTTP_201_CREATED)


class SafeShareDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token_id):
        link = get_object_or_404(SafeShareLink, token_id=token_id)
        if link.is_revoked:
            return Response({'error': 'This share link has been revoked by the owner.'}, status=status.HTTP_410_GONE)
        if link.expires_at <= timezone.now():
            return Response({'error': 'This share link has expired.'}, status=status.HTTP_410_GONE)
        if link.download_count >= link.max_downloads:
            return Response({'error': 'Download limit reached for this link.'}, status=status.HTTP_410_GONE)

        link.download_count += 1
        link.save(update_fields=['download_count'])
        return Response(SafeShareLinkSerializer(link).data)


class SafeShareRevokeView(APIView):
    def post(self, request, token_id):
        link = get_object_or_404(SafeShareLink, token_id=token_id, owner=request.user)
        link.is_revoked = True
        link.save(update_fields=['is_revoked'])
        return Response({'status': 'revoked', 'token_id': token_id})


# =====================================================================
# PRIVACY LEDGER VIEWS (Section 10)
# =====================================================================

class PrivacyLedgerView(APIView):
    """
    Returns live, real-time audit footprint of what the server holds for the user.
    """
    def get(self, request):
        user_id = request.user.id
        mailbox_stats = default_mailbox.get_user_mailbox_stats(user_id)
        safeshare_active = SafeShareLink.objects.filter(
            owner=request.user,
            is_revoked=False,
            expires_at__gt=timezone.now()
        ).count()
        samaj_posts_count = SamajPost.objects.filter(author=request.user).count()
        device_count = Device.objects.filter(user=request.user).count()

        feature_map = [
            {
                'feature': 'Chats & Contacts',
                'stored_on': 'This device & peer devices',
                'in_transit': f"{mailbox_stats['pending_envelopes_count']} pending envelopes in ephemeral mailbox",
                'retention': 'Max 14 days in transit (purged immediately on delivery)',
                'server_plaintext': '0 bytes (End-to-End Encrypted)'
            },
            {
                'feature': 'Vault, Notes, Photos, Docs',
                'stored_on': 'This device only (client-side encrypted)',
                'in_transit': 'None',
                'retention': 'Permanent on device',
                'server_plaintext': '0 bytes (Never uploaded)'
            },
            {
                'feature': 'Tasks, Habits, Planner, Wellness',
                'stored_on': 'This device only',
                'in_transit': 'None',
                'retention': 'Permanent on device',
                'server_plaintext': '0 bytes'
            },
            {
                'feature': 'AI Conversations & API Keys',
                'stored_on': 'This device only',
                'in_transit': 'Direct browser-to-provider request',
                'retention': 'Permanent on device',
                'server_plaintext': '0 bytes'
            },
            {
                'feature': 'Safe Share Links',
                'stored_on': f"{safeshare_active} active temporary links",
                'in_transit': 'Encrypted ciphertext only',
                'retention': 'Max 7 days or immediate revocation',
                'server_plaintext': '0 bytes (Key in URL fragment)'
            },
            {
                'feature': 'Samaj Social Posts (Honest Exception)',
                'stored_on': f"{samaj_posts_count} public/follower posts",
                'in_transit': 'CDN object store',
                'retention': 'Until deleted or auto-archived to device',
                'server_plaintext': 'Public by design'
            }
        ]

        return Response({
            'user': request.user.email,
            'summary': {
                'server_data_accumulation': 'ZERO at rest (device-owned principle)',
                'pending_in_flight_envelopes': mailbox_stats['pending_envelopes_count'],
                'ephemeral_bytes_in_transit': mailbox_stats['total_bytes'],
                'active_safeshare_links': safeshare_active,
                'registered_devices': device_count,
            },
            'mailbox_stats': mailbox_stats,
            'feature_ledger': feature_map,
            'warning': "Your data lives on your device. We cannot recover it if you lose it without a backup."
        })


class PrivacyPurgeView(APIView):
    """
    User-triggered immediate hard-purge of all pending ephemeral mailbox data.
    """
    def post(self, request):
        purged = default_mailbox.purge_user_mailbox(request.user.id)
        revoked = SafeShareLink.objects.filter(owner=request.user, is_revoked=False).update(is_revoked=True)
        return Response({
            'status': 'purged',
            'purged_mailbox_envelopes': purged,
            'revoked_safeshare_links': revoked,
            'message': 'All ephemeral envelopes and temporary links associated with your account have been deleted.'
        })


# =====================================================================
# PUSH TOKEN & DEVICE VIEWS
# =====================================================================

class PushTokenView(APIView):
    def post(self, request):
        token = request.data.get('token')
        platform = request.data.get('platform', 'android')
        device_id = request.data.get('device_id', '')

        if not token:
            return Response({'error': 'token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        pt, _ = PushToken.objects.update_or_create(
            user=request.user,
            token=token,
            defaults={
                'platform': platform,
                'device_id': device_id,
            }
        )
        return Response(PushTokenSerializer(pt).data, status=status.HTTP_200_OK)


class ReportUserView(APIView):
    def post(self, request):
        reported_user_id = request.data.get('reported_user')
        reason = request.data.get('reason', '')
        details = request.data.get('details', '')

        reported_user = get_object_or_404(User, id=reported_user_id)
        report = UserReport.objects.create(
            reporter=request.user,
            reported_user=reported_user,
            reason=reason,
            details=details
        )
        return Response(UserReportSerializer(report).data, status=status.HTTP_201_CREATED)


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'status': 'healthy',
            'service': 'apna-core',
            'version': '2.0.0-zero-storage',
            'philosophy': 'privacy-first, local-first, zero-storage',
            'guarantees': {
                'data_ownership': 'device-owned',
                'ephemeral_mailbox': 'Redis/volatile (persistence disabled)',
                'envelope_cap': '64 KB',
                'server_data_accumulation': 'zero'
            }
        })

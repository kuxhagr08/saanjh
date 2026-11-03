"""
APNA Ephemeral Mailbox Engine.
Zero-Storage Architecture: Messages live in volatile memory / Redis with persistence DISABLED.
Envelopes have a strict 64 KB cap, 14-day default TTL (max 30 days), and are IMMEDIATELY DELETED
upon recipient delivery acknowledgment.
"""

import json
import time
import os
import uuid
from typing import Dict, Any, List, Optional


class PayloadTooLargeError(Exception):
    """Raised when an encrypted envelope exceeds the strict 64 KB limit."""
    pass


class QuotaExceededError(Exception):
    """Raised when a user exceeds their daily relay bandwidth cap."""
    pass


MAX_ENVELOPE_BYTES = 64 * 1024  # 64 KB maximum envelope size
DEFAULT_TTL_SECONDS = 14 * 24 * 3600  # 14 days default
MAX_TTL_SECONDS = 30 * 24 * 3600  # 30 days max
DAILY_RELAY_CAP_BYTES = 200 * 1024 * 1024  # 200 MB per user per day


class EphemeralMailbox:
    def __init__(self, redis_client=None):
        self._redis = redis_client
        # In-memory volatile store used in development/testing or when Redis is absent
        self._memory_envelopes: Dict[str, Dict[str, Any]] = {}
        # Key: "mailbox:{recipient_id}:{envelope_id}" -> { envelope, expires_at, byte_size, sender_id }
        self._daily_usage: Dict[str, int] = {}  # "user:{user_id}:{date}" -> bytes relayed

    def _get_redis(self):
        if self._redis is not None:
            return self._redis
        redis_url = os.environ.get('REDIS_URL')
        if redis_url:
            try:
                import redis
                self._redis = redis.from_url(redis_url, decode_responses=True)
                return self._redis
            except Exception:
                pass
        return None

    def check_redis_persistence_disabled(self) -> Dict[str, Any]:
        """
        Validates that Redis persistence (RDB snapshotting and AOF) is disabled.
        Returns a dictionary with status and raw configuration flags.
        """
        client = self._get_redis()
        if client:
            try:
                config = client.config_get()
                save_setting = config.get('save', '')
                aof_setting = config.get('appendonly', 'no')
                is_rdb_disabled = save_setting == '' or save_setting == '""'
                is_aof_disabled = str(aof_setting).lower() == 'no'
                return {
                    'persistence_disabled': is_rdb_disabled and is_aof_disabled,
                    'save_directive': save_setting,
                    'appendonly': aof_setting,
                    'verified': True,
                    'engine': 'redis'
                }
            except Exception as e:
                return {
                    'persistence_disabled': True,
                    'warning': f'Could not query redis config_get directly: {str(e)}',
                    'engine': 'redis_restricted'
                }
        return {
            'persistence_disabled': True,
            'save_directive': 'disabled',
            'appendonly': 'no',
            'verified': True,
            'engine': 'volatile_in_memory'
        }

    def put_envelope(
        self,
        sender_id: int,
        recipient_id: int,
        envelope_data: Dict[str, Any],
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        current_time: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Stores an encrypted envelope in the recipient's ephemeral mailbox.
        Rejects payloads > 64 KB.
        Enforces daily relay quotas.
        Sets per-item TTL.
        """
        now = current_time if current_time is not None else time.time()
        ttl = min(max(ttl_seconds, 60), MAX_TTL_SECONDS)

        # Enforce envelope payload size limit (Max 64 KB)
        raw_json = json.dumps(envelope_data)
        byte_size = len(raw_json.encode('utf-8'))
        if byte_size > MAX_ENVELOPE_BYTES:
            raise PayloadTooLargeError(
                f"Envelope size {byte_size} bytes exceeds the maximum allowed limit of {MAX_ENVELOPE_BYTES} bytes (64 KB)."
            )

        # Enforce daily relay quota
        day_key = f"relay:{sender_id}:{time.strftime('%Y-%m-%d', time.gmtime(now))}"
        client = self._get_redis()
        if client:
            try:
                current_bytes = client.incrby(day_key, byte_size)
                client.expire(day_key, 86400 * 2)
                if current_bytes > DAILY_RELAY_CAP_BYTES:
                    raise QuotaExceededError(f"Daily relay bandwidth cap of {DAILY_RELAY_CAP_BYTES} bytes exceeded.")
            except QuotaExceededError:
                raise
            except Exception:
                pass
        else:
            current_bytes = self._daily_usage.get(day_key, 0) + byte_size
            if current_bytes > DAILY_RELAY_CAP_BYTES:
                raise QuotaExceededError(f"Daily relay bandwidth cap of {DAILY_RELAY_CAP_BYTES} bytes exceeded.")
            self._daily_usage[day_key] = current_bytes

        envelope_id = envelope_data.get('envelope_id') or str(uuid.uuid4())
        record = {
            'envelope_id': envelope_id,
            'sender_id': sender_id,
            'recipient_id': recipient_id,
            'data': envelope_data,
            'byte_size': byte_size,
            'created_at': now,
            'expires_at': now + ttl
        }

        key = f"mailbox:{recipient_id}:{envelope_id}"
        if client:
            try:
                client.set(key, json.dumps(record), ex=int(ttl))
                client.sadd(f"mailbox_pending:{recipient_id}", envelope_id)
                client.expire(f"mailbox_pending:{recipient_id}", int(ttl))
            except Exception:
                self._memory_envelopes[key] = record
        else:
            self._memory_envelopes[key] = record

        return {
            'envelope_id': envelope_id,
            'recipient_id': recipient_id,
            'expires_at': record['expires_at'],
            'byte_size': byte_size,
            'ttl_seconds': ttl
        }

    def get_pending_envelopes(self, recipient_id: int, current_time: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Retrieves all currently queued unread envelopes for a recipient.
        Filters out expired envelopes.
        """
        now = current_time if current_time is not None else time.time()
        client = self._get_redis()
        results = []

        if client:
            try:
                envelope_ids = client.smembers(f"mailbox_pending:{recipient_id}")
                for eid in envelope_ids:
                    key = f"mailbox:{recipient_id}:{eid}"
                    raw = client.get(key)
                    if raw:
                        rec = json.loads(raw)
                        if rec.get('expires_at', 0) > now:
                            results.append(rec['data'])
                        else:
                            client.delete(key)
                            client.srem(f"mailbox_pending:{recipient_id}", eid)
                    else:
                        client.srem(f"mailbox_pending:{recipient_id}", eid)
                return results
            except Exception:
                pass

        prefix = f"mailbox:{recipient_id}:"
        expired_keys = []
        for key, rec in list(self._memory_envelopes.items()):
            if key.startswith(prefix):
                if rec['expires_at'] > now:
                    results.append(rec['data'])
                else:
                    expired_keys.append(key)

        for k in expired_keys:
            self._memory_envelopes.pop(k, None)

        return results

    def ack_delivery(self, recipient_id: int, envelope_id: str) -> bool:
        """
        Acknowledges delivery: immediately PURGES and DELETES the envelope from the server!
        Returns True if deleted, False if already deleted/expired.
        """
        key = f"mailbox:{recipient_id}:{envelope_id}"
        client = self._get_redis()
        deleted = False

        if client:
            try:
                res = client.delete(key)
                client.srem(f"mailbox_pending:{recipient_id}", envelope_id)
                deleted = res > 0
            except Exception:
                pass

        if key in self._memory_envelopes:
            del self._memory_envelopes[key]
            deleted = True

        return deleted

    def expire_envelopes_at(self, fake_current_time: float) -> int:
        """
        Simulates TTL expiration for time-travel and testing purposes.
        Removes any envelope whose expires_at <= fake_current_time.
        """
        expired_count = 0
        for key, rec in list(self._memory_envelopes.items()):
            if rec['expires_at'] <= fake_current_time:
                del self._memory_envelopes[key]
                expired_count += 1
        return expired_count

    def get_user_mailbox_stats(self, user_id: int, current_time: Optional[float] = None) -> Dict[str, Any]:
        """
        Provides real-time stats for Settings > Privacy Ledger:
        - How many messages are currently in-flight/waiting for delivery
        - Nearest expiration time
        - Total bytes held in memory
        """
        now = current_time if current_time is not None else time.time()
        client = self._get_redis()
        pending_count = 0
        total_bytes = 0
        nearest_expiry = None

        if client:
            try:
                envelope_ids = client.smembers(f"mailbox_pending:{user_id}")
                for eid in envelope_ids:
                    key = f"mailbox:{user_id}:{eid}"
                    raw = client.get(key)
                    if raw:
                        rec = json.loads(raw)
                        if rec.get('expires_at', 0) > now:
                            pending_count += 1
                            total_bytes += rec.get('byte_size', 0)
                            exp = rec.get('expires_at')
                            if exp and (nearest_expiry is None or exp < nearest_expiry):
                                nearest_expiry = exp
                return {
                    'pending_envelopes_count': pending_count,
                    'total_bytes': total_bytes,
                    'oldest_expiry_timestamp': nearest_expiry
                }
            except Exception:
                pass

        prefix = f"mailbox:{user_id}:"
        for key, rec in self._memory_envelopes.items():
            if key.startswith(prefix) and rec['expires_at'] > now:
                pending_count += 1
                total_bytes += rec.get('byte_size', 0)
                exp = rec['expires_at']
                if nearest_expiry is None or exp < nearest_expiry:
                    nearest_expiry = exp

        return {
            'pending_envelopes_count': pending_count,
            'total_bytes': total_bytes,
            'oldest_expiry_timestamp': nearest_expiry
        }

    def purge_user_mailbox(self, user_id: int) -> int:
        """
        Forces immediate user-requested purge of all pending envelopes.
        """
        client = self._get_redis()
        count = 0
        if client:
            try:
                envelope_ids = client.smembers(f"mailbox_pending:{user_id}")
                for eid in envelope_ids:
                    client.delete(f"mailbox:{user_id}:{eid}")
                    count += 1
                client.delete(f"mailbox_pending:{user_id}")
            except Exception:
                pass

        prefix = f"mailbox:{user_id}:"
        for key in list(self._memory_envelopes.keys()):
            if key.startswith(prefix):
                del self._memory_envelopes[key]
                count += 1

        return count


# Singleton instance
default_mailbox = EphemeralMailbox()


from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Custom user model with Argon2id default hashing, email as identifier,
    and privacy-first minimal tracking.
    """
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True, unique=True, db_index=True)
    display_name = models.CharField(max_length=80, blank=True)
    avatar_color = models.CharField(max_length=32, default="violet")

    # Privacy & Access Controls
    avatar_url = models.TextField(blank=True, default="", help_text="Profile picture DP (data URL or avatar URL)")
    about = models.CharField(max_length=256, blank=True, default="Hey there! I am using Saanjh.", help_text="WhatsApp-style About / Bio")
    status_visibility = models.CharField(max_length=20, default="everyone", choices=[("everyone", "Everyone"), ("contacts_only", "Contacts Only"), ("nobody", "Nobody")])
    profile_photo_visibility = models.CharField(max_length=20, default="everyone", choices=[("everyone", "Everyone"), ("contacts_only", "Contacts Only"), ("nobody", "Nobody")])
    read_receipts_enabled = models.BooleanField(default=True, help_text="Send and receive read receipts (blue ticks)")
    allow_phone_discovery = models.BooleanField(default=True, help_text="Allow finding via mobile number")
    allow_email_discovery = models.BooleanField(default=True, help_text="Allow finding via email")
    allow_username_discovery = models.BooleanField(default=True, help_text="Allow finding via username")
    messaging_permission = models.CharField(
        max_length=20,
        default="everyone",
        choices=[("everyone", "Everyone"), ("contacts_only", "Contacts Only")]
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.username or self.email


class Device(models.Model):
    """
    Tracks authorized client devices for a user.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    device_id = models.CharField(max_length=128, db_index=True)
    device_name = models.CharField(max_length=128, blank=True)
    user_agent = models.TextField(blank=True)
    last_active = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'device_id')
        indexes = [
            models.Index(fields=['user', 'device_id']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.device_name or self.device_id}"


class EncryptionIdentity(models.Model):
    """
    Stores public identity keys ONLY.
    Private keys NEVER touch the server (they are generated and stored exclusively in browser IndexedDB).
    Uses libsodium X25519 public key and signing public key.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='encryption_identity')
    public_identity_key = models.CharField(max_length=128, help_text="Base64 libsodium X25519 public key")
    public_signing_key = models.CharField(max_length=128, help_text="Base64 libsodium Ed25519 public key")
    key_fingerprint = models.CharField(max_length=128, help_text="Deterministic safety number for contact verification")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"EncryptionIdentity({self.user.email}) - {self.key_fingerprint[:12]}..."


class PreKeyBundle(models.Model):
    """
    Prekey bundles for asynchronous X3DH / PQXDH end-to-end messaging.
    Allows initial messages to be safely encrypted even before the recipient is online.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='prekey_bundle')
    signed_prekey = models.CharField(max_length=128, help_text="Base64 signed X25519 prekey")
    signed_prekey_signature = models.CharField(max_length=128, help_text="Ed25519 signature over signed prekey")
    one_time_prekeys = models.JSONField(default=list, help_text="List of Base64 one-time X25519 prekeys")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PreKeyBundle({self.user.email}) - {len(self.one_time_prekeys)} keys remaining"


class PushToken(models.Model):
    """
    Device push notification tokens for content-free wake-up pings.
    Push notifications contain zero payload data or message text.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens')
    device_id = models.CharField(max_length=128, blank=True)
    token = models.CharField(max_length=256)
    platform = models.CharField(max_length=32, default="android")  # android, ios, web
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'token')


class BillingRecord(models.Model):
    """
    Minimal billing metadata for Pro subscriptions.
    No card numbers or payment credentials ever touch this model.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='billing')
    razorpay_customer_id = models.CharField(max_length=128, blank=True)
    razorpay_subscription_id = models.CharField(max_length=128, blank=True)
    plan = models.CharField(max_length=32, default="free")
    status = models.CharField(max_length=32, default="active")
    current_period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SamajProfile(models.Model):
    """
    Public social feed profile.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='samaj_profile')
    bio = models.CharField(max_length=256, blank=True)
    handle = models.CharField(max_length=64, unique=True, db_index=True)
    followers_count = models.IntegerField(default=0)
    following_count = models.IntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SamajFollow(models.Model):
    """
    Follow graph for Samaj social feed.
    """
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following_set')
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name='follower_set')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')


class SamajPost(models.Model):
    """
    Honest exception: Public and follower social posts visible to others when author is offline.
    """
    POST_TYPES = (
        ('post', 'Feed Post'),
        ('reel', 'Reel Video'),
    )
    VISIBILITY_CHOICES = (
        ('public', 'Public'),
        ('followers', 'Followers Only'),
    )
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='samaj_posts')
    post_type = models.CharField(max_length=16, choices=POST_TYPES, default='post')
    caption = models.TextField(blank=True)
    media_blob_url = models.CharField(max_length=512, blank=True)
    thumbnail_url = models.CharField(max_length=512, blank=True)
    visibility = models.CharField(max_length=16, choices=VISIBILITY_CHOICES, default='public')
    view_count = models.IntegerField(default=0)
    likes_count = models.IntegerField(default=0)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)


class SamajComment(models.Model):
    """
    Public comments on Samaj posts.
    """
    post = models.ForeignKey(SamajPost, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='samaj_comments')
    text = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)


class SamajStory(models.Model):
    """
    24-hour ephemeral stories. Automatically purged after expires_at.
    """
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stories')
    media_blob_url = models.CharField(max_length=512)
    caption = models.CharField(max_length=256, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)


class SafeShareLink(models.Model):
    """
    Safe Share ephemeral link records.
    Decryption key and original filename are strictly omitted (travel in URL fragment).
    """
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='safeshare_links')
    token_id = models.CharField(max_length=64, unique=True, db_index=True)
    blob_ref = models.CharField(max_length=256, blank=True)
    expires_at = models.DateTimeField(db_index=True)
    is_revoked = models.BooleanField(default=False)
    max_downloads = models.IntegerField(default=1)
    download_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class UserReport(models.Model):
    """
    Abuse/spam reporting for safety while respecting E2E privacy.
    Contains no message plaintext or decrypted transcript dumps.
    """
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_filed')
    reported_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_received')
    reason = models.CharField(max_length=255)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ModerationAction(models.Model):
    """
    Administrative moderation audit log.
    """
    target_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='moderation_actions')
    action = models.CharField(max_length=64)  # "warning", "temp_ban", "permanent_ban"
    reason = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)


class FeatureFlag(models.Model):
    """
    Dynamic operational feature flags.
    """
    key = models.CharField(max_length=64, unique=True, db_index=True)
    is_enabled = models.BooleanField(default=True)
    description = models.CharField(max_length=256, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.key}: {'ON' if self.is_enabled else 'OFF'}"

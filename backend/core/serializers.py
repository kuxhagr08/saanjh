import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
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

User = get_user_model()


def normalize_phone(phone: str) -> str:
    """Normalize phone number: strip spaces, dashes, parens, ensure standard string."""
    if not phone:
        return ""
    has_plus = phone.strip().startswith('+')
    digits = re.sub(r'\D', '', phone)
    return ('+' if has_plus else '') + digits


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=20)
    username = serializers.CharField(required=True, min_length=3, max_length=50)

    class Meta:
        model = User
        fields = ('id', 'email', 'phone_number', 'username', 'display_name', 'avatar_color', 'password')

    def validate_username(self, value):
        v = value.strip().lower()
        if not re.match(r'^[a-zA-Z0-9_.-]+$', v):
            raise serializers.ValidationError("Username can only contain letters, numbers, periods, hyphens and underscores.")
        if User.objects.filter(username__iexact=v).exists():
            raise serializers.ValidationError("This username is already taken.")
        return v

    def validate_phone_number(self, value):
        if not value:
            return ""
        norm = normalize_phone(value)
        if len(re.sub(r'\D', '', norm)) < 10:
            raise serializers.ValidationError("Please enter a valid mobile number (at least 10 digits).")
        if User.objects.filter(phone_number=norm).exists():
            raise serializers.ValidationError("This mobile number is already registered.")
        return norm

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'].strip().lower(),
            email=validated_data['email'].strip().lower(),
            password=validated_data['password'],
            phone_number=validated_data.get('phone_number') or None,
            display_name=validated_data.get('display_name', '') or validated_data['username'],
            avatar_color=validated_data.get('avatar_color', 'violet')
        )
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    has_keys = serializers.SerializerMethodField()
    public_identity_key = serializers.SerializerMethodField()
    public_signing_key = serializers.SerializerMethodField()
    key_fingerprint = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'phone_number', 'username', 'display_name',
            'avatar_color', 'avatar_url', 'about',
            'status_visibility', 'profile_photo_visibility', 'read_receipts_enabled',
            'allow_phone_discovery', 'allow_email_discovery',
            'allow_username_discovery', 'messaging_permission',
            'created_at', 'has_keys',
            'public_identity_key', 'public_signing_key', 'key_fingerprint'
        )
        read_only_fields = ('id', 'created_at')

    def get_has_keys(self, obj):
        return hasattr(obj, 'encryption_identity')

    def get_public_identity_key(self, obj):
        eid = getattr(obj, 'encryption_identity', None)
        return eid.public_identity_key if eid else ''

    def get_public_signing_key(self, obj):
        eid = getattr(obj, 'encryption_identity', None)
        return eid.public_signing_key if eid else ''

    def get_key_fingerprint(self, obj):
        eid = getattr(obj, 'encryption_identity', None)
        return eid.key_fingerprint if eid else ''

    def validate_phone_number(self, value):
        if not value:
            return ""
        norm = normalize_phone(value)
        existing = User.objects.filter(phone_number=norm).exclude(id=self.instance.id if self.instance else None).first()
        if existing:
            raise serializers.ValidationError("This mobile number is already in use by another account.")
        return norm


class EncryptionIdentitySerializer(serializers.ModelSerializer):
    user_id = serializers.ReadOnlyField(source='user.id')
    user_username = serializers.ReadOnlyField(source='user.username')
    user_display_name = serializers.ReadOnlyField(source='user.display_name')
    user_avatar_color = serializers.ReadOnlyField(source='user.avatar_color')
    user_email = serializers.SerializerMethodField()
    user_phone = serializers.SerializerMethodField()
    messaging_permission = serializers.ReadOnlyField(source='user.messaging_permission')

    class Meta:
        model = EncryptionIdentity
        fields = (
            'id', 'user', 'user_id', 'user_username', 'user_email', 'user_phone',
            'user_display_name', 'user_avatar_color', 'public_identity_key',
            'public_signing_key', 'key_fingerprint', 'messaging_permission', 'updated_at'
        )
        read_only_fields = ('id', 'user', 'updated_at')

    def get_user_email(self, obj):
        request = self.context.get('request')
        # Privacy guarantee: Never expose raw email to strangers/lookup requests. Only self can see.
        if request and request.user == obj.user:
            return obj.user.email
        return None

    def get_user_phone(self, obj):
        request = self.context.get('request')
        # Privacy guarantee: Never expose phone number to strangers/lookup requests. Only self can see.
        if request and request.user == obj.user:
            return obj.user.phone_number
        return None


class PreKeyBundleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreKeyBundle
        fields = ('id', 'signed_prekey', 'signed_prekey_signature', 'one_time_prekeys', 'updated_at')
        read_only_fields = ('id', 'updated_at')


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ('id', 'device_id', 'device_name', 'user_agent', 'last_active', 'created_at')
        read_only_fields = ('id', 'last_active', 'created_at')


class PushTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushToken
        fields = ('id', 'device_id', 'token', 'platform', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class BillingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingRecord
        fields = ('id', 'plan', 'status', 'current_period_end', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class SamajPostSerializer(serializers.ModelSerializer):
    author_username = serializers.ReadOnlyField(source='author.username')
    author_display_name = serializers.ReadOnlyField(source='author.display_name')
    author_avatar_color = serializers.ReadOnlyField(source='author.avatar_color')

    class Meta:
        model = SamajPost
        fields = (
            'id', 'author', 'author_username', 'author_display_name', 'author_avatar_color',
            'post_type', 'caption', 'media_blob_url', 'thumbnail_url', 'visibility',
            'view_count', 'likes_count', 'created_at', 'expires_at'
        )
        read_only_fields = ('id', 'author', 'view_count', 'likes_count', 'created_at')


class SamajCommentSerializer(serializers.ModelSerializer):
    author_username = serializers.ReadOnlyField(source='author.username')

    class Meta:
        model = SamajComment
        fields = ('id', 'post', 'author', 'author_username', 'text', 'created_at')
        read_only_fields = ('id', 'author', 'created_at')


class SafeShareLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafeShareLink
        fields = ('id', 'token_id', 'blob_ref', 'expires_at', 'is_revoked', 'max_downloads', 'download_count', 'created_at')
        read_only_fields = ('id', 'download_count', 'created_at')


class UserReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserReport
        fields = ('id', 'reported_user', 'reason', 'details', 'created_at')
        read_only_fields = ('id', 'created_at')


class EphemeralEnvelopeSerializer(serializers.Serializer):
    """
    Validates in-flight encrypted messages destined for recipient's ephemeral mailbox.
    Ciphertext has a strict maximum length (max 64 KB).
    """
    recipient_id = serializers.IntegerField(required=True)
    ciphertext = serializers.CharField(required=True)
    nonce = serializers.CharField(required=False, default="")
    ephemeral_public_key = serializers.CharField(required=False, default="")
    envelope_id = serializers.CharField(required=False)
    ttl_seconds = serializers.IntegerField(required=False, default=14 * 86400, min_value=60, max_value=30 * 86400)

    def validate_ciphertext(self, value):
        # Base64 string length check to ensure under 64 KB
        if len(value.encode('utf-8')) > 64 * 1024:
            raise serializers.ValidationError("Ciphertext payload exceeds 64 KB limit.")
        return value

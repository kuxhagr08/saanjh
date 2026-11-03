from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    LoginView,
    CurrentUserView,
    IdentityKeyView,
    PreKeyBundleView,
    ContactLookupView,
    MailboxSendView,
    MailboxPendingView,
    MailboxAckView,
    SafeShareCreateView,
    SafeShareDetailView,
    SafeShareRevokeView,
    PrivacyLedgerView,
    PrivacyPurgeView,
    PushTokenView,
    ReportUserView,
    HealthCheckView,
)

urlpatterns = [
    # Health check
    path('health/', HealthCheckView.as_view(), name='health'),

    # Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),

    # E2E Identity Keys & Prekeys (Public keys only)
    path('identity/keys/', IdentityKeyView.as_view(), name='identity_keys'),
    path('identity/prekeys/', PreKeyBundleView.as_view(), name='identity_prekeys'),
    path('contacts/lookup/', ContactLookupView.as_view(), name='contact_lookup'),

    # Zero-Storage Ephemeral Mailbox (Volatile / Redis with NO persistence, max 64 KB, delete on ack)
    path('mailbox/send/', MailboxSendView.as_view(), name='mailbox_send'),
    path('mailbox/pending/', MailboxPendingView.as_view(), name='mailbox_pending'),
    path('mailbox/ack/', MailboxAckView.as_view(), name='mailbox_ack'),

    # Safe Share (P2P first / Ephemeral ciphertext blob with key in fragment)
    path('safeshare/', SafeShareCreateView.as_view(), name='safeshare_create'),
    path('safeshare/<str:token_id>/', SafeShareDetailView.as_view(), name='safeshare_detail'),
    path('safeshare/<str:token_id>/revoke/', SafeShareRevokeView.as_view(), name='safeshare_revoke'),

    # Privacy Ledger & Live Server Footprint Audit
    path('privacy/ledger/', PrivacyLedgerView.as_view(), name='privacy_ledger'),
    path('privacy/purge/', PrivacyPurgeView.as_view(), name='privacy_purge'),

    # Devices & Push Tokens (Content-Free Wake-ups)
    path('devices/push-token/', PushTokenView.as_view(), name='push_token'),

    # Safety & Abuse Reporting
    path('reports/', ReportUserView.as_view(), name='user_reports'),
]

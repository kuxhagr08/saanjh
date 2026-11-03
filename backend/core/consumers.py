import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from urllib.parse import parse_qs
from .mailbox import default_mailbox, PayloadTooLargeError, QuotaExceededError

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Real-time blind relay WebSocket consumer.
    Strictly zero data accumulation at rest in Postgres.
    Ephemeral in-memory channel broadcast when peers are active;
    queues to EphemeralMailbox (Redis / in-memory with TTL and delete on ack) when recipient is offline.
    """
    async def connect(self):
        self.conv_id = self.scope['url_route']['kwargs'].get('conv_id', 'direct')
        self.room_group_name = f'chat_{self.conv_id}'

        # Authenticate user from query string token: ?token=xyz
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        user = None
        if token_list:
            token = token_list[0]
            user = await self.get_user_from_token(token)

        if not user:
            await self.close(code=4001)
            return

        self.scope['user'] = user

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except Exception:
            return

        msg_type = data.get('type')

        if msg_type == 'typing':
            # Broadcast typing indicator (ephemeral in-memory event)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_typing',
                    'user_id': self.scope['user'].id,
                    'is_typing': data.get('is_typing', True)
                }
            )
        elif msg_type == 'encrypted_message':
            ciphertext = data.get('ciphertext')
            nonce = data.get('nonce', '')
            ephemeral_key = data.get('ephemeral_public_key', '')
            envelope_id = data.get('envelope_id')
            recipient_id = data.get('recipient_id')

            if not ciphertext:
                return

            envelope_payload = {
                'envelope_id': envelope_id or str(self.scope['user'].id),
                'sender_id': self.scope['user'].id,
                'sender_email': self.scope['user'].email,
                'sender_username': self.scope['user'].username,
                'recipient_id': recipient_id,
                'ciphertext': ciphertext,
                'nonce': nonce,
                'ephemeral_public_key': ephemeral_key,
                'is_delivered': False
            }

            # If recipient_id specified, also buffer in ephemeral mailbox for offline pickup
            if recipient_id:
                try:
                    default_mailbox.put_envelope(
                        sender_id=self.scope['user'].id,
                        recipient_id=int(recipient_id),
                        envelope_data=envelope_payload
                    )
                except (PayloadTooLargeError, QuotaExceededError) as e:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': str(e)
                    }))
                    return

            # Broadcast in real-time to active room members
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': envelope_payload
                }
            )

        elif msg_type == 'webrtc_signal':
            # P2P WebRTC Signaling (call_request, call_accept, call_reject, call_end, offer, answer, ice_candidate)
            # ZERO database writes - strictly peer-to-peer relay through volatile memory
            signal = data.get('signal') or {
                'type': data.get('signal_type'),
                'payload': data.get('payload')
            }
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_webrtc_signal',
                    'sender_id': self.scope['user'].id,
                    'signal': signal,
                    'signal_type': data.get('signal_type') or (signal.get('type') if isinstance(signal, dict) else None),
                    'payload': data.get('payload') or (signal.get('payload') if isinstance(signal, dict) else signal),
                    'call_type': data.get('call_type', 'audio'),
                }
            )

        elif msg_type == 'ack_delivery':
            # Delivery ack: hard-purge from EphemeralMailbox
            envelope_id = data.get('envelope_id')
            if envelope_id:
                default_mailbox.ack_delivery(self.scope['user'].id, str(envelope_id))
                await self.send(text_data=json.dumps({
                    'type': 'ack_confirmed',
                    'envelope_id': envelope_id,
                    'purged': True
                }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'data': event['message']
        }))

    async def chat_typing(self, event):
        if event['user_id'] != self.scope['user'].id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'is_typing': event['is_typing']
            }))

    async def chat_webrtc_signal(self, event):
        if event['sender_id'] != self.scope['user'].id:
            await self.send(text_data=json.dumps({
                'type': 'webrtc_signal',
                'sender_id': event['sender_id'],
                'signal': event.get('signal'),
                'signal_type': event.get('signal_type'),
                'payload': event.get('payload'),
                'call_type': event.get('call_type', 'audio'),
            }))

    @database_sync_to_async
    def get_user_from_token(self, token_str):
        try:
            token = AccessToken(token_str)
            user_id = token['user_id']
            return User.objects.get(id=user_id)
        except Exception:
            return None


class UserConsumer(AsyncWebsocketConsumer):
    """
    Persistent per-user connection for real-time notifications,
    incoming call alerts, WebRTC signaling relay, and wakeups.
    Zero DB storage - purely ephemeral in-memory relay.
    """
    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        user = None
        if token_list:
            token = token_list[0]
            user = await self.get_user_from_token(token)

        if not user:
            await self.close(code=4001)
            return

        self.scope['user'] = user
        self.user_group_name = f'user_{user.id}'

        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except Exception:
            return

        msg_type = data.get('type')
        if msg_type == 'webrtc_signal':
            recipient_id = data.get('recipient_id')
            if not recipient_id:
                return

            recipient_group = f'user_{recipient_id}'
            await self.channel_layer.group_send(
                recipient_group,
                {
                    'type': 'user_webrtc_signal',
                    'sender_id': self.scope['user'].id,
                    'sender_name': self.scope['user'].display_name or self.scope['user'].username,
                    'sender_email': self.scope['user'].email,
                    'sender_avatar_url': getattr(self.scope['user'], 'avatar_url', ''),
                    'sender_avatar_color': self.scope['user'].avatar_color,
                    'signal': data.get('signal'),
                    'call_type': data.get('call_type', 'audio'),
                    'conversation_id': data.get('conversation_id'),
                }
            )

    async def user_webrtc_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'webrtc_signal',
            'sender_id': event['sender_id'],
            'sender_name': event['sender_name'],
            'sender_email': event['sender_email'],
            'sender_avatar_url': event.get('sender_avatar_url', ''),
            'sender_avatar_color': event.get('sender_avatar_color', 'violet'),
            'signal': event['signal'],
            'call_type': event.get('call_type', 'audio'),
            'conversation_id': event.get('conversation_id'),
        }))

    @database_sync_to_async
    def get_user_from_token(self, token_str):
        try:
            token = AccessToken(token_str)
            user_id = token['user_id']
            return User.objects.get(id=user_id)
        except Exception:
            return None

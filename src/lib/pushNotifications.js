import supabase from './supabaseClient.js';
import { getMessaging } from './firebaseAdmin.js';
import logger from './logger.js';

// Ported from server/src/utils/pushNotifications.js. Sends to whatever
// device tokens already exist for a user (e.g. the Android app), regardless
// of which app (Express or this one) triggered the event — this is send-only
// infra, unrelated to whether web push itself is built yet.

const removeToken = async (token) => {
  try {
    await supabase.from('device_tokens').delete().eq('fcm_token', token);
  } catch (err) {
    logger.error('Failed to remove stale device token', { error: err.message });
  }
};

const sendToTokens = async (tokens, { title, body, data }) => {
  if (!tokens.length) return;
  const messaging = getMessaging();
  if (!messaging) return;

  // FCM data payloads must be string-only.
  const stringData = Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)]));

  try {
    const response = await messaging.sendEachForMulticast({
      notification: { title, body },
      data: stringData,
      tokens
    });
    response.responses.forEach((result, i) => {
      if (!result.success && result.error?.code === 'messaging/registration-token-not-registered') {
        removeToken(tokens[i]);
      }
    });
  } catch (err) {
    logger.error('Push notification send failed', { error: err.message });
  }
};

// Both helpers are fire-and-forget by design — a push failure must never
// block or fail the HTTP response of the order/chat action that triggered it.

export const notifyUser = (userId, { title, body, data }) => {
  (async () => {
    try {
      const { data: rows, error } = await supabase.from('device_tokens').select('fcm_token').eq('user_id', userId);
      if (error) throw error;
      await sendToTokens(rows.map((r) => r.fcm_token), { title, body, data });
    } catch (err) {
      logger.error('notifyUser failed', { userId, error: err.message });
    }
  })();
};

export const notifyRole = (role, { title, body, data }) => {
  (async () => {
    try {
      const { data: staff, error: staffError } = await supabase.from('users').select('id').eq('role', role);
      if (staffError) throw staffError;
      const userIds = staff.map((u) => u.id);
      if (!userIds.length) return;

      const { data: rows, error } = await supabase.from('device_tokens').select('fcm_token').in('user_id', userIds);
      if (error) throw error;
      await sendToTokens(rows.map((r) => r.fcm_token), { title, body, data });
    } catch (err) {
      logger.error('notifyRole failed', { role, error: err.message });
    }
  })();
};

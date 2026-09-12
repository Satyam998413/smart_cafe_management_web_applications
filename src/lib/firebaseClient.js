'use client';

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

// Ported from react_app/src/firebase.js. Firebase project: smartcafemanager-2cc8b
// (same project as the Flutter app and server — see flutter_app/lib/firebase_options.dart
// and server/src/config/firebaseAdmin.js). The Web API key is a public client
// identifier, not a secret — safe to ship in the bundle, same as Google's own
// docs recommend. Next.js only exposes env vars prefixed NEXT_PUBLIC_ to
// client code (Vite's equivalent was VITE_).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Generated in Firebase Console > Project Settings > Cloud Messaging > Web
// Push certificates. Required by getToken() to authorize this origin.
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

const app = initializeApp(firebaseConfig);

// getMessaging() throws synchronously in browsers/contexts without service
// worker + Push API support (e.g. Safari in some modes, non-HTTPS origins
// other than localhost) — resolve support once and reuse everywhere so a
// bad browser never crashes the app, it just silently skips push.
const messagingPromise = isSupported().then((supported) => (supported ? getMessaging(app) : null));

/**
 * Requests notification permission (if needed) and returns an FCM
 * registration token, or null if permission was denied or push isn't
 * supported in this browser.
 */
export async function requestFcmToken() {
  const messaging = await messagingPromise;
  if (!messaging || !('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  try {
    return await getToken(messaging, { vapidKey: VAPID_KEY });
  } catch (err) {
    console.error('Failed to retrieve FCM token:', err);
    return null;
  }
}

/**
 * Subscribes to messages that arrive while this tab has focus (FCM does not
 * show these automatically — only background/terminated messages go through
 * public/firebase-messaging-sw.js). Returns an unsubscribe function.
 */
export function onForegroundMessage(callback) {
  let unsubscribe = () => {};
  messagingPromise.then((messaging) => {
    if (messaging) unsubscribe = onMessage(messaging, callback);
  });
  return () => unsubscribe();
}

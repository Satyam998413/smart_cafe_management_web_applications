// Ported unchanged from react_app/public/firebase-messaging-sw.js. FCM
// requires this exact file at the domain root — it runs in its own service
// worker context (no bundler, no ES modules), so it re-declares the Firebase
// config and uses the compat SDK via importScripts instead of the npm
// package used in src/lib/firebaseClient.js. Files under public/ are served
// verbatim by Next.js (not processed), so this can't read env vars — if the
// Firebase project config ever changes, update it here too.
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBHd1ePrkN3SbgL9NM8SduUoHN1q6Vy4Ik',
  authDomain: 'smartcafemanager-2cc8b.firebaseapp.com',
  projectId: 'smartcafemanager-2cc8b',
  storageBucket: 'smartcafemanager-2cc8b.firebasestorage.app',
  messagingSenderId: '781347078583',
  appId: '1:781347078583:web:ac306a06cff83a7e7aa832'
});

const messaging = firebase.messaging();

// Only fires for background/terminated tabs — a focused tab gets the
// message via onMessage() in src/lib/firebaseClient.js instead.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'Cremen Smart Spaces', {
    body,
    icon: '/favicon.svg',
    data: payload.data
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

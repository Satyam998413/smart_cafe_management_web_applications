// The broker-instance-holding + outbound-publish half of the MQTT wiring,
// split out of mqttServer.js specifically to avoid a circular import:
// mqttServer.js's inbound message handling calls into deviceEvents.js
// (recordHeartbeat, biometric enroll/verify), and deviceEvents.js's
// verification logic needs to publish OUT to a device (dispatchToDevice) —
// if both directions lived in mqttServer.js, deviceEvents.js and
// mqttServer.js would import each other. This module has no dependency on
// either, so both can depend on it instead.
//
// Mirrors src/lib/socketServer.js's exact shape (globalThis-stashed
// instance, set once at boot in server.js).
export const setAedes = (aedes) => {
  globalThis.__aedes = aedes;
};

export const getAedes = () => globalThis.__aedes ?? null;

/**
 * Pushes a message to a specific device over MQTT — the broker-side half of
 * dispatchToDevice's transport split (the other half being a plain outbound
 * HTTP call for api-transport devices). Never throws: a device being
 * offline/unsubscribed must not fail whatever already-committed action
 * (a verify response, an audit log write) triggered the push.
 */
export function publishToDevice(topic, payload) {
  const aedes = getAedes();
  if (!aedes) return;
  aedes.publish({ cmd: 'publish', topic, payload: JSON.stringify(payload), qos: 0, retain: false, dup: false }, (error) => {
    if (error) {
      // Lazy import to avoid pulling logger into this otherwise
      // dependency-free module's static import graph for no benefit.
      import('./logger.js').then(({ default: logger }) => {
        logger.warn('Failed to publish MQTT message', { topic, error: error.message });
      });
    }
  });
}

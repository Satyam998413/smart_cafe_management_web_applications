// Ported unchanged from server/src/services/iot/mockAdapter.js.
// Reference/dev adapter (plan Phase 6b) — the only one until a real IoT
// vendor is named (gaps doc §3's open question). Every real vendor adapter
// (Tuya cloud API, Tasmota/MQTT, Zigbee2MQTT, ...) implements this exact
// { getState, sendCommand } shape, resolved by device.vendor in
// adapterResolver.js — same pattern as lib/aiClient.js's provider switch.
//
// No real hardware to talk to, so every command "just works": acks
// immediately with the value it was given. This is intentionally the
// simplest possible adapter — its job is to prove the registry/command/
// state-sync plumbing end-to-end before a real vendor integration exists.
export const mockAdapter = {
  async getState(device) {
    return { deviceId: device.id, online: true };
  },

  async sendCommand(device, capability, value) {
    return { capability, value, status: 'acked' };
  }
};

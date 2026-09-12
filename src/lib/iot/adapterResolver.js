import { mockAdapter } from './mockAdapter.js';

// Ported unchanged from server/src/services/iot/adapterResolver.js. One
// entry per vendor.js file — add a new one here (and a new
// lib/iot/<vendor>Adapter.js) once a real IoT vendor/protocol is named;
// nothing else in the codebase needs to change, same "adapter picked by
// config" shape as lib/aiClient.js's AI_PROVIDER switch.
const ADAPTERS = {
  mock: mockAdapter
};

export const resolveAdapter = (vendor) => {
  const adapter = ADAPTERS[vendor];
  if (!adapter) {
    throw new Error(`No IoT adapter registered for vendor: ${vendor}`);
  }
  return adapter;
};

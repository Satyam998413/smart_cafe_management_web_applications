import { describe, it, expect, vi, afterEach } from 'vitest';
import { setAedes, getAedes, publishToDevice } from './mqttPublish.js';

describe('publishToDevice', () => {
  afterEach(() => {
    setAedes(null);
    vi.clearAllMocks();
  });

  it('no-ops when no broker instance is set', () => {
    expect(() => publishToDevice('access/d1/result', { matched: true })).not.toThrow();
  });

  it('publishes a JSON-encoded packet through the broker instance', () => {
    const publish = vi.fn((packet, cb) => cb());
    setAedes({ publish });
    publishToDevice('access/d1/result', { matched: true });

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'access/d1/result', payload: JSON.stringify({ matched: true }) }),
      expect.any(Function)
    );
    expect(getAedes().publish).toBe(publish);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOnline, withOnlineStatus, HEARTBEAT_OFFLINE_THRESHOLD_MS } from './deviceStatus.js';

describe('isOnline', () => {
  afterEach(() => vi.useRealTimers());

  it('is false when there has never been a heartbeat', () => {
    expect(isOnline(null)).toBe(false);
    expect(isOnline(undefined)).toBe(false);
  });

  it('is false for an unparsable timestamp', () => {
    expect(isOnline('not-a-date')).toBe(false);
  });

  it('is true just under the threshold and false just over it', () => {
    const now = new Date('2026-01-01T00:01:00.000Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const justUnder = new Date(now - (HEARTBEAT_OFFLINE_THRESHOLD_MS - 1000)).toISOString();
    const justOver = new Date(now - (HEARTBEAT_OFFLINE_THRESHOLD_MS + 1000)).toISOString();

    expect(isOnline(justUnder)).toBe(true);
    expect(isOnline(justOver)).toBe(false);
  });
});

describe('withOnlineStatus', () => {
  it('decorates a single row without mutating the input', () => {
    const row = { id: 'd1', last_heartbeat_at: new Date().toISOString() };
    const result = withOnlineStatus(row);
    expect(result.online).toBe(true);
    expect(row.online).toBeUndefined();
  });

  it('decorates an array of rows', () => {
    const rows = [{ id: 'd1', last_heartbeat_at: null }, { id: 'd2', last_heartbeat_at: new Date().toISOString() }];
    const result = withOnlineStatus(rows);
    expect(result.map((r) => r.online)).toEqual([false, true]);
  });
});

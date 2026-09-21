import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { mintDeviceToken } from '@/lib/deviceAuth.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/devices/heartbeat';
const request = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const deviceHeader = (token) => ({ authorization: `Bearer ${token}` });

describe('POST /api/devices/heartbeat', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a device token', async () => {
    const res = await POST(request({ wifiRssi: -60 }));
    expect(res.status).toBe(401);
  });

  it('rejects a validly-signed token whose hash no longer matches the stored one (revoked/rotated)', async () => {
    const token = mintDeviceToken({ deviceId: 'd1', orgId: 'org-1', category: 'controller' });
    supabase.from.mockReturnValue(
      createMockQueryBuilder({ data: { id: 'd1', org_id: 'org-1', refresh_token_hash: 'stale-hash' }, error: null })
    );

    const res = await POST(request({ wifiRssi: -60 }, deviceHeader(token)));
    expect(res.status).toBe(403);
  });

  it('records a bare liveness ping with no wifiRssi (the routine ~30s heartbeat)', async () => {
    const token = mintDeviceToken({ deviceId: 'd1', orgId: 'org-1', category: 'controller' });
    const { hashDeviceToken } = await import('@/lib/deviceAuth.js');
    const lookupBuilder = createMockQueryBuilder({
      data: { id: 'd1', org_id: 'org-1', refresh_token_hash: hashDeviceToken(token) },
      error: null
    });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'd1', last_heartbeat_at: '2026-01-01T00:00:00.000Z' }, error: null });
    supabase.from.mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(updateBuilder);

    const res = await POST(request({}, deviceHeader(token)));
    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_heartbeat_at: expect.any(String) })
    );
    expect(updateBuilder.update).not.toHaveBeenCalledWith(expect.objectContaining({ device_wifi_rssi: expect.anything() }));
  });

  it('records the device-reported Wi-Fi RSSI alongside the heartbeat when the token hash matches', async () => {
    const token = mintDeviceToken({ deviceId: 'd1', orgId: 'org-1', category: 'controller' });
    const { hashDeviceToken } = await import('@/lib/deviceAuth.js');
    const lookupBuilder = createMockQueryBuilder({
      data: { id: 'd1', org_id: 'org-1', refresh_token_hash: hashDeviceToken(token) },
      error: null
    });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'd1', last_heartbeat_at: '2026-01-01T00:00:00.000Z' }, error: null });
    supabase.from.mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(updateBuilder);

    const res = await POST(request({ wifiRssi: -58 }, deviceHeader(token)));

    expect(res.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('devices');
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ device_wifi_rssi: -58, last_heartbeat_at: expect.any(String) })
    );
  });
});

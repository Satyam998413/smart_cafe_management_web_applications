import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { PATCH } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/technician/device-settings';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('PATCH /api/technician/device-settings', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await PATCH(jsonRequest({ category: 'controller', deviceId: 'd1' }));
    expect(res.status).toBe(401);
  });

  it('rejects roles other than technician/master_admin', async () => {
    const res = await PATCH(jsonRequest({ category: 'controller', deviceId: 'd1' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(403);
  });

  it('rejects an unknown category', async () => {
    const res = await PATCH(
      jsonRequest({ category: 'toaster', deviceId: 'd1', deviceType: 'api' }, authHeader({ role: 'technician' }))
    );
    expect(res.status).toBe(400);
  });

  it('rejects a deviceType outside api/mqtt', async () => {
    const res = await PATCH(
      jsonRequest({ category: 'controller', deviceId: 'd1', deviceType: 'zigbee' }, authHeader({ role: 'technician' }))
    );
    expect(res.status).toBe(400);
  });

  it('rejects settings that are not a JSON object', async () => {
    const res = await PATCH(
      jsonRequest(
        { category: 'controller', deviceId: 'd1', settings: ['not', 'an', 'object'] },
        authHeader({ role: 'technician' })
      )
    );
    expect(res.status).toBe(400);
  });

  it('saves deviceType/endpointUrl/settings onto the category-mapped table', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'd1', transport_type: 'mqtt' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await PATCH(
      jsonRequest(
        {
          category: 'controller',
          deviceId: 'd1',
          deviceType: 'mqtt',
          endpointUrl: 'mqtt://broker.example.com:1883',
          settings: { topicPrefix: 'org1/devices/d1' }
        },
        authHeader({ role: 'technician' })
      )
    );

    expect(res.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('devices');
    expect(builder.update).toHaveBeenCalledWith({
      transport_type: 'mqtt',
      endpoint_url: 'mqtt://broker.example.com:1883',
      settings: { topicPrefix: 'org1/devices/d1' }
    });
  });

  it('routes lock/punching categories to their own tables', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'lock-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await PATCH(
      jsonRequest({ category: 'lock', deviceId: 'lock-1', deviceType: 'api' }, authHeader({ role: 'master_admin', isMasterAdmin: true }))
    );

    expect(supabase.from).toHaveBeenCalledWith('smart_locks');
  });
});

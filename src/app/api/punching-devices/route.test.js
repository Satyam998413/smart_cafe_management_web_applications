import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/punching-devices';
const getRequest = (headers = {}) => new NextRequest(URL, { method: 'GET', headers });
const postRequest = (body, headers = {}) =>
  new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('GET /api/punching-devices', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it('lists devices scoped to the caller org with computed online status', async () => {
    const builder = createMockQueryBuilder({
      data: [{ id: 'p1', device_name: 'Front Desk', last_heartbeat_at: null }],
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await GET(getRequest(authHeader({ role: 'owner', orgId: 'org-1' })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(body[0].online).toBe(false);
  });
});

describe('POST /api/punching-devices', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects a cook (insufficient role)', async () => {
    const res = await POST(
      postRequest({ device_name: 'Kitchen Door', device_type: 'rfid_reader' }, authHeader({ role: 'cook', orgId: 'org-1' }))
    );
    expect(res.status).toBe(403);
  });

  it('requires device_name and device_type', async () => {
    const res = await POST(postRequest({ device_name: 'Kitchen Door' }, authHeader({ role: 'owner', orgId: 'org-1' })));
    expect(res.status).toBe(400);
  });

  it('registers a punching device and stamps org_id', async () => {
    const builder = createMockQueryBuilder({
      data: { id: 'p2', device_name: 'Main Gate', device_type: 'thumbprint_scanner', org_id: 'org-1' },
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      postRequest(
        { device_name: 'Main Gate', device_type: 'thumbprint_scanner' },
        authHeader({ role: 'technician', orgId: 'org-1' })
      )
    );

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ org_id: 'org-1', device_type: 'thumbprint_scanner' }));
  });

  it('surfaces a 409 on a duplicate serial number', async () => {
    const builder = createMockQueryBuilder({ data: null, error: { code: '23505' } });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      postRequest(
        { device_name: 'Dup', device_type: 'rfid_reader', serial_number: 'SN-1' },
        authHeader({ role: 'owner', orgId: 'org-1' })
      )
    );

    expect(res.status).toBe(409);
  });
});

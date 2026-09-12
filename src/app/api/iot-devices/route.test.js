import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/iot-devices';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/iot-devices', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects roles other than owner/manager', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'cook' }) }));
    expect(res.status).toBe(403);
  });

  it('allows manager, filters by spaceId when given', async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(`${URL}?spaceId=space-1`, { headers: authHeader({ role: 'manager' }) }));

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('space_id', 'space-1');
  });
});

describe('POST /api/iot-devices', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ spaceId: 's1', name: 'Lamp', type: 'light' }));
    expect(res.status).toBe(401);
  });

  it('rejects a manager — registration is owner-only even though GET allows manager', async () => {
    const res = await POST(jsonRequest({ spaceId: 's1', name: 'Lamp', type: 'light' }, authHeader({ role: 'manager' })));
    expect(res.status).toBe(403);
  });

  it('requires spaceId, name, and type', async () => {
    const res = await POST(jsonRequest({ name: 'Lamp' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(400);
  });

  it('registers the device, defaulting vendor to mock and stamping org_id', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'device-1', vendor: 'mock' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      jsonRequest({ spaceId: 's1', name: 'Lamp', type: 'light' }, authHeader({ role: 'owner', orgId: 'org-1' }))
    );

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ space_id: 's1', name: 'Lamp', type: 'light', vendor: 'mock', org_id: 'org-1' })
    );
  });
});

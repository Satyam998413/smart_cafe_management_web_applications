import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/technician/rfid-cards';
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('POST /api/technician/rfid-cards', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ orgId: 'org-1', cardNumber: 'AB12CD' }));
    expect(res.status).toBe(401);
  });

  it('rejects owner/manager — only technician or master admin may create', async () => {
    const res = await POST(jsonRequest({ orgId: 'org-1', cardNumber: 'AB12CD' }, authHeader({ role: 'owner' })));
    expect(res.status).toBe(403);
  });

  it('requires orgId and cardNumber', async () => {
    const res = await POST(jsonRequest({ orgId: 'org-1' }, authHeader({ role: 'technician' })));
    expect(res.status).toBe(400);
  });

  it('creates the card unassigned, stamping created_by', async () => {
    const builder = createMockQueryBuilder({
      data: { id: 'card-1', org_id: 'org-1', card_number: 'AB12CD', assigned_to_user_id: null, access_level: 'unassigned' },
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      jsonRequest({ orgId: 'org-1', cardNumber: 'AB12CD' }, authHeader({ role: 'technician', userId: 'tech-1' }))
    );

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        org_id: 'org-1',
        card_number: 'AB12CD',
        assigned_to_user_id: null,
        access_level: 'unassigned',
        created_by: 'tech-1'
      })
    ]);
  });

  it('409s on a duplicate card for the same org', async () => {
    const builder = createMockQueryBuilder({ data: null, error: { code: '23505', message: 'duplicate key' } });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest({ orgId: 'org-1', cardNumber: 'AB12CD' }, authHeader({ role: 'technician' })));
    expect(res.status).toBe(409);
  });

  it('allows master admin too', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'card-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      jsonRequest({ orgId: 'org-1', cardNumber: 'AB12CD' }, authHeader({ role: 'master_admin', isMasterAdmin: true }))
    );
    expect(res.status).toBe(201);
  });
});

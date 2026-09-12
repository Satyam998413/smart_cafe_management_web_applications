import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { triggerAccountingExport, emitToRooms } from '@/lib/billingHelpers.js';
import { getIo } from '@/lib/socketServer.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/billingHelpers.js', () => ({ triggerAccountingExport: vi.fn(), emitToRooms: vi.fn() }));
vi.mock('@/lib/socketServer.js', () => ({ getIo: vi.fn(() => null) }));

const URL = 'http://localhost/api/bills/bill-1/collect-cash';
const params = Promise.resolve({ id: 'bill-1' });
const request = (headers) => new NextRequest(URL, { method: 'POST', headers });

describe('POST /api/bills/[id]/collect-cash', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(request(), { params });
    expect(res.status).toBe(401);
  });

  it('rejects roles other than owner/manager', async () => {
    const res = await POST(request(authHeader({ role: 'cook' })), { params });
    expect(res.status).toBe(403);
  });

  it('404s when no pending cash bill matches (atomic guard)', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(request(authHeader({ role: 'manager' })), { params });

    expect(res.status).toBe(404);
  });

  it('marks the bill paid, scoped by org_id, and triggers the accounting export', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid', customer_id: 'cust-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(request(authHeader({ role: 'manager', userId: 'mgr-1', orgId: 'org-1' })), { params });

    expect(res.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid', cash_collected_by: 'mgr-1' })
    );
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.eq).toHaveBeenCalledWith('payment_method', 'cash');
    expect(triggerAccountingExport).toHaveBeenCalledWith('bill-1');
  });

  it('emits bill_update to the manager/owner rooms and the paying customer', async () => {
    const fakeIo = {};
    getIo.mockReturnValue(fakeIo);
    const builder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid', customer_id: 'cust-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await POST(request(authHeader({ role: 'owner', orgId: 'org-1' })), { params });

    expect(emitToRooms).toHaveBeenCalledWith(
      fakeIo,
      ['role-manager', 'role-owner', 'user-cust-1'],
      'bill_update',
      expect.objectContaining({ id: 'bill-1', status: 'paid' })
    );
  });
});

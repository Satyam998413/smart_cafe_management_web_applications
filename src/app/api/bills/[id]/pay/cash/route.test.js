import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { getIo } from '@/lib/socketServer.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/socketServer.js', () => ({ getIo: vi.fn() }));

const URL = 'http://localhost/api/bills/bill-1/pay/cash';
const params = Promise.resolve({ id: 'bill-1' });
const request = (headers) => new NextRequest(URL, { method: 'POST', headers });

describe('POST /api/bills/[id]/pay/cash', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(request(), { params });
    expect(res.status).toBe(401);
  });

  it('404s when the bill is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(request(authHeader()), { params });

    expect(res.status).toBe(404);
  });

  it('400s when the bill is already settled', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid' }, error: null }));

    const res = await POST(request(authHeader()), { params });

    expect(res.status).toBe(400);
  });

  it('records the cash choice without marking the bill paid', async () => {
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending' }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'bill-1', payment_method: 'cash', status: 'pending' }, error: null });
    supabase.from.mockReturnValueOnce(billBuilder).mockReturnValueOnce(updateBuilder);

    const res = await POST(request(authHeader()), { params });

    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({ payment_method: 'cash' });
  });

  it('emits bill_update to role-manager/role-owner so staff can build a live pending-cash list', async () => {
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending' }, error: null });
    const updateBuilder = createMockQueryBuilder({ data: { id: 'bill-1', payment_method: 'cash', status: 'pending' }, error: null });
    supabase.from.mockReturnValueOnce(billBuilder).mockReturnValueOnce(updateBuilder);
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    getIo.mockReturnValue({ to });

    await POST(request(authHeader()), { params });

    expect(to).toHaveBeenCalledWith(['role-manager', 'role-owner']);
    expect(emit).toHaveBeenCalledWith('bill_update', expect.objectContaining({ id: 'bill-1' }));
  });
});

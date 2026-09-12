import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/bills/company-statement';

describe('GET /api/bills/company-statement', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects roles other than owner/manager', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'cook' }) }));
    expect(res.status).toBe(403);
  });

  it('sums company-charged orders in range and applies date filters', async () => {
    const builder = createMockQueryBuilder({
      data: [{ id: 'o1', total_amount: 10 }, { id: 'o2', total_amount: 5 }],
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await GET(
      new NextRequest(`${URL}?fromDate=2026-01-01&toDate=2026-01-31`, { headers: authHeader({ role: 'owner', orgId: 'org-1' }) })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ orderCount: 2, totalAmount: 15 });
    expect(builder.eq).toHaveBeenCalledWith('billing_mode', 'company_charged');
    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(builder.gte).toHaveBeenCalled();
    expect(builder.lte).toHaveBeenCalled();
  });
});

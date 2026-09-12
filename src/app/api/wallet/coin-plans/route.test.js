import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/wallet/coin-plans';

describe('GET /api/wallet/coin-plans', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects non-owners', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'manager' }) }));
    expect(res.status).toBe(403);
  });

  it('lists active plans, cheapest first, camelCased', async () => {
    const builder = createMockQueryBuilder({
      data: [{ id: 'plan-1', name: 'Starter', price_inr: '500', coins_granted: 500, bonus_coins: 0 }],
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner' }) }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([{ id: 'plan-1', name: 'Starter', priceInr: 500, coinsGranted: 500, bonusCoins: 0 }]);
    expect(builder.eq).toHaveBeenCalledWith('is_active', true);
  });
});

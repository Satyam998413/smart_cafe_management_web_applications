import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { logAudit } from '@/lib/auditLog.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/auditLog.js', () => ({ logAudit: vi.fn() }));

const URL = 'http://localhost/api/admin/coin-plans';
const masterAdminHeader = () => authHeader({ isMasterAdmin: true });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const VALID_PLAN = { name: 'Starter', priceInr: 500, coinsGranted: 500 };

describe('GET /api/admin/coin-plans', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader() }));
    expect(res.status).toBe(403);
  });

  it('lists every plan, active and inactive, sorted by sortOrder', async () => {
    const builder = createMockQueryBuilder({ data: [{ id: 'plan-1', is_active: false }], error: null });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(URL, { headers: masterAdminHeader() }));

    expect(res.status).toBe(200);
    expect(builder.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    const body = await res.json();
    expect(body).toEqual([expect.objectContaining({ id: 'plan-1', isActive: false })]);
  });
});

describe('POST /api/admin/coin-plans', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', VALID_PLAN));
    expect(res.status).toBe(401);
  });

  it('rejects a non-master-admin', async () => {
    const res = await POST(jsonRequest('POST', VALID_PLAN, authHeader({ role: 'owner' })));
    expect(res.status).toBe(403);
  });

  it('requires name, priceInr, and coinsGranted', async () => {
    const res = await POST(jsonRequest('POST', { name: 'X' }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive priceInr', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_PLAN, priceInr: 0 }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects a negative coinsGranted', async () => {
    const res = await POST(jsonRequest('POST', { ...VALID_PLAN, coinsGranted: -5 }, masterAdminHeader()));
    expect(res.status).toBe(400);
  });

  it('creates the plan, defaults bonusCoins/isActive/sortOrder, and logs the audit entry', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'plan-1', name: 'Starter' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(jsonRequest('POST', VALID_PLAN, masterAdminHeader()));

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Starter', price_inr: 500, coins_granted: 500, bonus_coins: 0, is_active: true, sort_order: 0 })
    );
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'coin_plan_created', targetId: 'plan-1' }));
  });
});

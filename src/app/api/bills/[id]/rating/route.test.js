import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/bills/bill-1/rating';
const params = Promise.resolve({ id: 'bill-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('POST /api/bills/[id]/rating', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ foodRating: 5 }), { params });
    expect(res.status).toBe(401);
  });

  it('requires at least one of foodRating/serviceRating', async () => {
    const res = await POST(jsonRequest({}, authHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('404s when the bill is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(jsonRequest({ foodRating: 5 }, authHeader()), { params });

    expect(res.status).toBe(404);
  });

  it('400s when the bill has not been paid', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending' }, error: null }));

    const res = await POST(jsonRequest({ foodRating: 5 }, authHeader()), { params });

    expect(res.status).toBe(400);
  });

  it('records the rating once the bill is paid', async () => {
    const billBuilder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid' }, error: null });
    const ratingBuilder = createMockQueryBuilder({ data: { id: 'rating-1', food_rating: 5 }, error: null });
    supabase.from.mockReturnValueOnce(billBuilder).mockReturnValueOnce(ratingBuilder);

    const res = await POST(
      jsonRequest({ foodRating: 5, serviceRating: 4, suggestion: 'More vegan options' }, authHeader({ userId: 'cust-1' })),
      { params }
    );

    expect(res.status).toBe(201);
    expect(ratingBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ bill_id: 'bill-1', customer_id: 'cust-1', food_rating: 5, service_rating: 4 })
    );
  });
});

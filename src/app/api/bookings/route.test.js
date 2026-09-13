import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST, GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/bookings';
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

const ROOM = {
  id: 'room-1',
  kind: 'room',
  is_bookable: true,
  price_per_night: 100,
  max_occupancy: 2,
  site: { id: 'site-1', org_id: 'org-1' }
};

describe('POST /api/bookings', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', {}));
    expect(res.status).toBe(401);
  });

  it('requires spaceId, checkIn, and checkOut', async () => {
    const res = await POST(jsonRequest('POST', { spaceId: 'room-1' }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('rejects checkOut on or before checkIn', async () => {
    const res = await POST(
      jsonRequest('POST', { spaceId: 'room-1', checkIn: '2026-01-05', checkOut: '2026-01-05' }, authHeader())
    );
    expect(res.status).toBe(400);
  });

  it('404s when the room does not exist or is not a bookable room', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await POST(
      jsonRequest('POST', { spaceId: 'room-1', checkIn: '2026-01-05', checkOut: '2026-01-07' }, authHeader())
    );
    expect(res.status).toBe(404);
  });

  it('400s when the room has no nightly rate set', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { ...ROOM, price_per_night: null }, error: null }));
    const res = await POST(
      jsonRequest('POST', { spaceId: 'room-1', checkIn: '2026-01-05', checkOut: '2026-01-07' }, authHeader())
    );
    expect(res.status).toBe(400);
  });

  it('400s when the party size exceeds max_occupancy', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: ROOM, error: null }));
    const res = await POST(
      jsonRequest(
        'POST',
        { spaceId: 'room-1', checkIn: '2026-01-05', checkOut: '2026-01-07', numGuests: 5 },
        authHeader()
      )
    );
    expect(res.status).toBe(400);
  });

  it('409s when the room is already booked for an overlapping range', async () => {
    const roomBuilder = createMockQueryBuilder({ data: ROOM, error: null });
    const overlapBuilder = createMockQueryBuilder({ data: [{ id: 'existing-booking' }], error: null });
    supabase.from.mockReturnValueOnce(roomBuilder).mockReturnValueOnce(overlapBuilder);

    const res = await POST(
      jsonRequest('POST', { spaceId: 'room-1', checkIn: '2026-01-05', checkOut: '2026-01-07' }, authHeader())
    );

    expect(res.status).toBe(409);
  });

  it('creates a pending_payment booking with the snapshotted nightly rate and computed total', async () => {
    const roomBuilder = createMockQueryBuilder({ data: ROOM, error: null });
    const overlapBuilder = createMockQueryBuilder({ data: [], error: null });
    const insertBuilder = createMockQueryBuilder({ data: { id: 'booking-1', status: 'pending_payment' }, error: null });
    supabase.from.mockReturnValueOnce(roomBuilder).mockReturnValueOnce(overlapBuilder).mockReturnValueOnce(insertBuilder);

    const res = await POST(
      jsonRequest(
        'POST',
        { spaceId: 'room-1', checkIn: '2026-01-05', checkOut: '2026-01-08', numGuests: 2 },
        authHeader({ userId: 'cust-1' })
      )
    );

    expect(res.status).toBe(201);
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        space_id: 'room-1',
        customer_id: 'cust-1',
        nightly_rate: 100,
        total_price: 300, // 3 nights * 100
        num_guests: 2
      })
    );
  });
});

describe('GET /api/bookings', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(401);
  });

  it("scopes a customer's request to their own bookings", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'customer', userId: 'cust-1' }) }));

    expect(builder.eq).toHaveBeenCalledWith('customer_id', 'cust-1');
  });

  it("scopes an owner's request to their org, not their own user id", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    supabase.from.mockReturnValue(builder);

    await GET(new NextRequest(URL, { headers: authHeader({ role: 'owner', orgId: 'org-1' }) }));

    expect(builder.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });
});

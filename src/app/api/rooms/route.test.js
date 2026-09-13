import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/rooms';

describe('GET /api/rooms', () => {
  afterEach(() => vi.clearAllMocks());

  it('requires siteId', async () => {
    const res = await GET(new NextRequest(URL));
    expect(res.status).toBe(400);
  });

  it('requires checkIn and checkOut together, not just one', async () => {
    const res = await GET(new NextRequest(`${URL}?siteId=site-1&checkIn=2026-01-05`));
    expect(res.status).toBe(400);
  });

  it('rejects checkOut on or before checkIn', async () => {
    const res = await GET(new NextRequest(`${URL}?siteId=site-1&checkIn=2026-01-05&checkOut=2026-01-05`));
    expect(res.status).toBe(400);
  });

  it('lists bookable rooms without an availability flag when no dates are given', async () => {
    const builder = createMockQueryBuilder({
      data: [{ id: 'room-1', kind: 'room', is_bookable: true, price_per_night: 100, space_images: [] }],
      error: null
    });
    supabase.from.mockReturnValue(builder);

    const res = await GET(new NextRequest(`${URL}?siteId=site-1`));

    expect(res.status).toBe(200);
    expect(builder.eq).toHaveBeenCalledWith('kind', 'room');
    expect(builder.eq).toHaveBeenCalledWith('is_bookable', true);
    const body = await res.json();
    expect(body[0].available).toBeUndefined();
  });

  it('marks a room unavailable when an overlapping booking exists', async () => {
    const roomsBuilder = createMockQueryBuilder({
      data: [{ id: 'room-1', kind: 'room', is_bookable: true, price_per_night: 100, space_images: [] }],
      error: null
    });
    const overlapBuilder = createMockQueryBuilder({ data: [{ id: 'existing' }], error: null });
    supabase.from.mockReturnValueOnce(roomsBuilder).mockReturnValueOnce(overlapBuilder);

    const res = await GET(new NextRequest(`${URL}?siteId=site-1&checkIn=2026-01-05&checkOut=2026-01-07`));

    const body = await res.json();
    expect(body[0].available).toBe(false);
  });
});

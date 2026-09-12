import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { GET } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/spaces/space-1/qr-context';
const params = Promise.resolve({ id: 'space-1' });
const request = () => new NextRequest(URL, { method: 'GET' });

describe('GET /api/spaces/[id]/qr-context', () => {
  afterEach(() => vi.clearAllMocks());

  it('is public — no auth header needed', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));
    const res = await GET(request(), { params });
    expect(res.status).toBe(404);
  });

  it('returns public org/site/space context for a valid space', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({
        data: {
          id: 'space-1',
          kind: 'table',
          label: 'Table 4',
          number: '4',
          site: { id: 'site-1', name: 'Main Branch', organization: { id: 'org-1', name: 'Smart Cafe', theme: {}, premise_type: 'cafe' } }
        },
        error: null
      })
    );

    const res = await GET(request(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      spaceId: 'space-1',
      spaceKind: 'table',
      spaceLabel: 'Table 4',
      spaceNumber: '4',
      siteId: 'site-1',
      siteName: 'Main Branch',
      organization: { id: 'org-1', name: 'Smart Cafe', theme: {}, premiseType: 'cafe' }
    });
  });

  it('returns organization: null when the space has no org (pre-migration)', async () => {
    supabase.from.mockReturnValue(
      createMockQueryBuilder({
        data: { id: 'space-1', kind: 'table', label: 'Table 4', number: '4', site: { id: 'site-1', name: 'Main Branch', organization: null } },
        error: null
      })
    );

    const res = await GET(request(), { params });
    const body = await res.json();

    expect(body.organization).toBeNull();
  });
});

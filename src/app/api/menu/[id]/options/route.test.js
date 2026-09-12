import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/menu/item-1/options';
const params = Promise.resolve({ id: 'item-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });

describe('POST /api/menu/[id]/options', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ name: 'Milk', choices: [{ label: 'Whole' }] }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-manager token', async () => {
    const res = await POST(
      jsonRequest({ name: 'Milk', choices: [{ label: 'Whole' }] }, authHeader({ role: 'waiter' })),
      { params }
    );
    expect(res.status).toBe(403);
  });

  it('requires a non-empty choices array', async () => {
    const res = await POST(jsonRequest({ name: 'Milk', choices: [] }, authHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid selectionType', async () => {
    const res = await POST(
      jsonRequest({ name: 'Milk', selectionType: 'bogus', choices: [{ label: 'Whole' }] }, authHeader()),
      { params }
    );
    expect(res.status).toBe(400);
  });

  it('stamps org_id on the group insert when the caller has one, and creates the choices', async () => {
    const groupBuilder = createMockQueryBuilder({ data: { id: 'group-1' }, error: null });
    const choicesBuilder = createMockQueryBuilder({ data: [{ id: 'choice-1', label: 'Whole' }], error: null });
    supabase.from.mockReturnValueOnce(groupBuilder).mockReturnValueOnce(choicesBuilder);

    const res = await POST(
      jsonRequest({ name: 'Milk', choices: [{ label: 'Whole' }] }, authHeader({ orgId: 'org-1' })),
      { params }
    );

    expect(res.status).toBe(201);
    expect(groupBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: 'org-1', menu_item_id: 'item-1' })
    );
    expect(choicesBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ option_group_id: 'group-1', label: 'Whole' })
    ]);
  });
});

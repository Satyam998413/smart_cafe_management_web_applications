import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));

const URL = 'http://localhost/api/manager-cook-chat/cook-1/messages';
const params = Promise.resolve({ otherUserId: 'cook-1' });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/manager-cook-chat/[otherUserId]/messages', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL), { params });
    expect(res.status).toBe(401);
  });

  it('rejects roles other than manager/cook', async () => {
    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'waiter' }) }), { params });
    expect(res.status).toBe(403);
  });

  it('resolves the pair from a manager caller, marks read, and returns the thread', async () => {
    const readBuilder = createMockQueryBuilder({ data: null, error: null });
    const listBuilder = createMockQueryBuilder({ data: [{ id: 'm1', manager_id: 'mgr-1', cook_id: 'cook-1' }], error: null });
    supabase.from.mockReturnValueOnce(readBuilder).mockReturnValueOnce(listBuilder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ role: 'manager', userId: 'mgr-1' }) }), { params });

    expect(res.status).toBe(200);
    expect(readBuilder.eq).toHaveBeenCalledWith('manager_id', 'mgr-1');
    expect(readBuilder.eq).toHaveBeenCalledWith('cook_id', 'cook-1');
    expect(readBuilder.eq).toHaveBeenCalledWith('sender_id', 'cook-1');
    expect(listBuilder.eq).toHaveBeenCalledWith('manager_id', 'mgr-1');
    expect(listBuilder.eq).toHaveBeenCalledWith('cook_id', 'cook-1');
  });
});

describe('POST /api/manager-cook-chat/[otherUserId]/messages', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', { body: 'hi' }), { params });
    expect(res.status).toBe(401);
  });

  it('requires a non-empty body', async () => {
    const res = await POST(jsonRequest('POST', { body: '   ' }, authHeader({ role: 'manager' })), { params });
    expect(res.status).toBe(400);
  });

  it("404s when the other party doesn't exist with the expected role", async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(jsonRequest('POST', { body: 'hi' }, authHeader({ role: 'manager' })), { params });

    expect(res.status).toBe(404);
  });

  it('sends the message, resolving the pair from a manager caller', async () => {
    const otherBuilder = createMockQueryBuilder({ data: { id: 'cook-1' }, error: null });
    const insertBuilder = createMockQueryBuilder({ data: { id: 'msg-1', manager_id: 'mgr-1', cook_id: 'cook-1' }, error: null });
    supabase.from.mockReturnValueOnce(otherBuilder).mockReturnValueOnce(insertBuilder);

    const res = await POST(
      jsonRequest('POST', { body: 'Order ready soon?' }, authHeader({ role: 'manager', userId: 'mgr-1', orgId: 'org-1' })),
      { params }
    );

    expect(res.status).toBe(201);
    expect(otherBuilder.eq).toHaveBeenCalledWith('role', 'cook');
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ manager_id: 'mgr-1', cook_id: 'cook-1', sender_id: 'mgr-1', org_id: 'org-1' })
    );
  });

  it('resolves the pair the other way when a cook sends', async () => {
    const otherBuilder = createMockQueryBuilder({ data: { id: 'mgr-1' }, error: null });
    const insertBuilder = createMockQueryBuilder({ data: { id: 'msg-1' }, error: null });
    supabase.from.mockReturnValueOnce(otherBuilder).mockReturnValueOnce(insertBuilder);

    await POST(
      jsonRequest('POST', { body: 'On it' }, authHeader({ role: 'cook', userId: 'cook-1' })),
      { params: Promise.resolve({ otherUserId: 'mgr-1' }) }
    );

    expect(otherBuilder.eq).toHaveBeenCalledWith('role', 'manager');
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ manager_id: 'mgr-1', cook_id: 'cook-1', sender_id: 'cook-1' })
    );
  });
});

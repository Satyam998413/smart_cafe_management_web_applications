import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { isAuthorizedForThread, currentCookFor } from '@/lib/chatHelpers.js';
import { notifyUser } from '@/lib/pushNotifications.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { GET, POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/pushNotifications.js', () => ({ notifyUser: vi.fn(), notifyRole: vi.fn() }));
vi.mock('@/lib/chatHelpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isAuthorizedForThread: vi.fn(), currentCookFor: vi.fn() };
});

const URL = 'http://localhost/api/chats/cust-1/messages';
const params = Promise.resolve({ userId: 'cust-1' });
const jsonRequest = (method, body, headers = {}) =>
  new NextRequest(URL, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('GET /api/chats/[userId]/messages', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await GET(new NextRequest(URL), { params });
    expect(res.status).toBe(401);
  });

  it('rejects a non-participant', async () => {
    isAuthorizedForThread.mockResolvedValue(false);

    const res = await GET(new NextRequest(URL, { headers: authHeader() }), { params });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid date', async () => {
    isAuthorizedForThread.mockResolvedValue(true);

    const res = await GET(new NextRequest(`${URL}?date=not-a-date`, { headers: authHeader() }), { params });

    expect(res.status).toBe(400);
  });

  it('returns the day of messages and marks the other party unread ones as read', async () => {
    isAuthorizedForThread.mockResolvedValue(true);
    const messagesBuilder = createMockQueryBuilder({
      data: [{ id: 'm1', sender_id: 'cook-1', read_at: null }, { id: 'm2', sender_id: 'user-1', read_at: null }],
      error: null
    });
    const updateBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(messagesBuilder).mockReturnValueOnce(updateBuilder);

    const res = await GET(new NextRequest(URL, { headers: authHeader({ userId: 'user-1' }) }), { params });

    expect(res.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }));
    expect(updateBuilder.in).toHaveBeenCalledWith('id', ['m1']);
  });
});

describe('POST /api/chats/[userId]/messages', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest('POST', { body: 'hi' }), { params });
    expect(res.status).toBe(401);
  });

  it('requires a non-empty body', async () => {
    const res = await POST(jsonRequest('POST', { body: '   ' }, authHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('rejects a non-participant', async () => {
    isAuthorizedForThread.mockResolvedValue(false);

    const res = await POST(jsonRequest('POST', { body: 'hi' }, authHeader()), { params });

    expect(res.status).toBe(403);
  });

  it('blocks a customer whose thread has no current cook', async () => {
    isAuthorizedForThread.mockResolvedValue(true);
    currentCookFor.mockResolvedValue(null);

    const res = await POST(
      jsonRequest('POST', { body: 'hi' }, authHeader({ role: 'customer', userId: 'cust-1' })),
      { params }
    );

    expect(res.status).toBe(403);
  });

  it('sends to the current cook when a customer sends', async () => {
    isAuthorizedForThread.mockResolvedValue(true);
    currentCookFor.mockResolvedValue('cook-1');
    const builder = createMockQueryBuilder({ data: { id: 'msg-1', user_id: 'cust-1', sender_id: 'cust-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      jsonRequest('POST', { body: 'Hello!' }, authHeader({ role: 'customer', userId: 'cust-1' })),
      { params }
    );

    expect(res.status).toBe(201);
    expect(notifyUser).toHaveBeenCalledWith('cook-1', expect.objectContaining({ title: 'New message' }));
  });

  it('sends directly to the customer when a cook sends, stamping org_id', async () => {
    isAuthorizedForThread.mockResolvedValue(true);
    const builder = createMockQueryBuilder({ data: { id: 'msg-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    const res = await POST(
      jsonRequest('POST', { body: 'Order is ready' }, authHeader({ role: 'cook', userId: 'cook-1', orgId: 'org-1' })),
      { params }
    );

    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'cust-1', sender_id: 'cook-1', org_id: 'org-1' })
    );
    expect(notifyUser).toHaveBeenCalledWith('cust-1', expect.anything());
  });
});

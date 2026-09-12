import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { sendChatCompletion, AiClientError } from '@/lib/aiClient.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST, _resetMenuCacheForTests } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/aiClient.js', async () => {
  const actual = await vi.importActual('@/lib/aiClient.js');
  return { ...actual, sendChatCompletion: vi.fn() };
});

const URL = 'http://localhost/api/ai/chat';
const request = (body, headers = {}) =>
  new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('POST /api/ai/chat', () => {
  afterEach(() => {
    vi.clearAllMocks();
    _resetMenuCacheForTests();
  });

  it('rejects without a token', async () => {
    const res = await POST(request({ message: 'hi' }));
    expect(res.status).toBe(401);
  });

  it('requires a non-empty message', async () => {
    const res = await POST(request({ message: '   ' }, authHeader()));
    expect(res.status).toBe(400);
  });

  it('returns the parsed reply/actions/done on a well-formed JSON response', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: [{ name: 'Latte', category: 'beverage', price: 150 }], error: null }));
    sendChatCompletion.mockResolvedValue({
      text: '{"reply":"Coming right up!","actions":[{"type":"add_item","name":"Latte","quantity":2}],"done":false}'
    });

    const res = await POST(request({ message: 'two lattes please' }, authHeader({ orgId: 'org-1' })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ reply: 'Coming right up!', actions: [{ type: 'add_item', name: 'Latte', quantity: 2 }], done: false });
    expect(sendChatCompletion).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1' }));
  });

  it('strips unknown action types before returning them', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: [], error: null }));
    sendChatCompletion.mockResolvedValue({
      text: '{"reply":"ok","actions":[{"type":"add_item","name":"Latte"},{"type":"delete_everything"}],"done":false}'
    });

    const res = await POST(request({ message: 'hi' }, authHeader()));
    const body = await res.json();

    expect(body.actions).toEqual([{ type: 'add_item', name: 'Latte' }]);
  });

  it('falls back to treating unparseable, non-JSON-looking text as plain speech', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: [], error: null }));
    sendChatCompletion.mockResolvedValue({ text: 'Sure thing, one sec!' });

    const res = await POST(request({ message: 'hi' }, authHeader()));
    const body = await res.json();

    expect(body).toEqual({ reply: 'Sure thing, one sec!', actions: [], done: false });
  });

  it('maps an AiClientError to a 502', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: [], error: null }));
    sendChatCompletion.mockRejectedValue(new AiClientError('No AI provider is configured'));

    const res = await POST(request({ message: 'hi' }, authHeader()));

    expect(res.status).toBe(502);
  });
});

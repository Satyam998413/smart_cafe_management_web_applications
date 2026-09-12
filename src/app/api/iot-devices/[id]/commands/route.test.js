import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { resolveAdapter } from '@/lib/iot/adapterResolver.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/iot/adapterResolver.js', () => ({ resolveAdapter: vi.fn() }));

const URL = 'http://localhost/api/iot-devices/device-1/commands';
const params = Promise.resolve({ id: 'device-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('POST /api/iot-devices/[id]/commands', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({ capability: 'on_off', value: true }), { params });
    expect(res.status).toBe(401);
  });

  it('rejects roles other than owner/manager', async () => {
    const res = await POST(jsonRequest({ capability: 'on_off', value: true }, authHeader({ role: 'cook' })), { params });
    expect(res.status).toBe(403);
  });

  it('requires capability and value', async () => {
    const res = await POST(jsonRequest({ capability: 'on_off' }, authHeader({ role: 'owner' })), { params });
    expect(res.status).toBe(400);
  });

  it('404s when the device is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(jsonRequest({ capability: 'on_off', value: true }, authHeader({ role: 'owner' })), { params });

    expect(res.status).toBe(404);
  });

  it('403s a manager without the canControlIot permission', async () => {
    const deviceBuilder = createMockQueryBuilder({ data: { id: 'device-1', vendor: 'mock' }, error: null });
    const actorBuilder = createMockQueryBuilder({ data: { permissions: {} }, error: null });
    supabase.from.mockReturnValueOnce(deviceBuilder).mockReturnValueOnce(actorBuilder);

    const res = await POST(
      jsonRequest({ capability: 'on_off', value: true }, authHeader({ role: 'manager', userId: 'mgr-1' })),
      { params }
    );

    expect(res.status).toBe(403);
  });

  it('an owner sends the command, records the audit row, and syncs merged state on ack', async () => {
    const deviceBuilder = createMockQueryBuilder({ data: { id: 'device-1', vendor: 'mock' }, error: null });
    const commandBuilder = createMockQueryBuilder({ data: { id: 'command-1' }, error: null });
    const statusUpdateBuilder = createMockQueryBuilder({ data: null, error: null });
    const existingStateBuilder = createMockQueryBuilder({ data: { state: { brightness: 50 } }, error: null });
    const upsertBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from
      .mockReturnValueOnce(deviceBuilder)
      .mockReturnValueOnce(commandBuilder)
      .mockReturnValueOnce(statusUpdateBuilder)
      .mockReturnValueOnce(existingStateBuilder)
      .mockReturnValueOnce(upsertBuilder);
    resolveAdapter.mockReturnValue({ sendCommand: vi.fn().mockResolvedValue({ status: 'acked' }) });

    const res = await POST(
      jsonRequest({ capability: 'on_off', value: true }, authHeader({ role: 'owner', userId: 'owner-1' })),
      { params }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ commandId: 'command-1', status: 'acked' });
    expect(commandBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ device_id: 'device-1', capability: 'on_off', value: true, issued_by: 'owner-1' })
    );
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ device_id: 'device-1', state: { brightness: 50, on_off: true } }),
      { onConflict: 'device_id' }
    );
  });

  it('a manager with the granted permission can send a command', async () => {
    const deviceBuilder = createMockQueryBuilder({ data: { id: 'device-1', vendor: 'mock' }, error: null });
    const actorBuilder = createMockQueryBuilder({ data: { permissions: { canControlIot: true } }, error: null });
    const commandBuilder = createMockQueryBuilder({ data: { id: 'command-1' }, error: null });
    const statusUpdateBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from
      .mockReturnValueOnce(deviceBuilder)
      .mockReturnValueOnce(actorBuilder)
      .mockReturnValueOnce(commandBuilder)
      .mockReturnValueOnce(statusUpdateBuilder);
    resolveAdapter.mockReturnValue({ sendCommand: vi.fn().mockResolvedValue({ status: 'sent' }) });

    const res = await POST(
      jsonRequest({ capability: 'on_off', value: false }, authHeader({ role: 'manager', userId: 'mgr-1' })),
      { params }
    );

    expect(res.status).toBe(200);
  });

  it('marks the command failed (not 500) when the adapter throws', async () => {
    const deviceBuilder = createMockQueryBuilder({ data: { id: 'device-1', vendor: 'mock' }, error: null });
    const commandBuilder = createMockQueryBuilder({ data: { id: 'command-1' }, error: null });
    const statusUpdateBuilder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValueOnce(deviceBuilder).mockReturnValueOnce(commandBuilder).mockReturnValueOnce(statusUpdateBuilder);
    resolveAdapter.mockReturnValue({ sendCommand: vi.fn().mockRejectedValue(new Error('device offline')) });

    const res = await POST(jsonRequest({ capability: 'on_off', value: true }, authHeader({ role: 'owner' })), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('failed');
    expect(statusUpdateBuilder.update).toHaveBeenCalledWith({ status: 'failed' });
  });
});

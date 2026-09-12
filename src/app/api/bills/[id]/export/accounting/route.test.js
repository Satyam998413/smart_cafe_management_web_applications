import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import { generateAccountingExport, generatePdfExport, buildInvoicePdfBuffer } from '@/lib/accountingExportService.js';
import { createMockQueryBuilder } from '@/testUtils/mockQueryBuilder.js';
import { authHeader } from '@/testUtils/authTestHelpers.js';
import { POST } from './route.js';

vi.mock('@/lib/supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('@/lib/accountingExportService.js', () => ({
  generateAccountingExport: vi.fn(),
  generatePdfExport: vi.fn(),
  buildInvoicePdfBuffer: vi.fn()
}));

const URL = 'http://localhost/api/bills/bill-1/export/accounting';
const params = Promise.resolve({ id: 'bill-1' });
const jsonRequest = (body, headers = {}) =>
  new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

describe('POST /api/bills/[id]/export/accounting', () => {
  afterEach(() => vi.clearAllMocks());

  it('rejects without a token', async () => {
    const res = await POST(jsonRequest({}), { params });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid format', async () => {
    const res = await POST(jsonRequest({ format: 'csv' }, authHeader()), { params });
    expect(res.status).toBe(400);
  });

  it('404s when the bill is not found', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    const res = await POST(jsonRequest({}, authHeader()), { params });

    expect(res.status).toBe(404);
  });

  it("400s when the bill hasn't been paid", async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'pending' }, error: null }));

    const res = await POST(jsonRequest({}, authHeader()), { params });

    expect(res.status).toBe(400);
  });

  it('returns the JSON export record by default', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid' }, error: null }));
    generateAccountingExport.mockResolvedValue({
      id: 'export-1',
      export_format: 'json',
      payload: { invoiceNumber: 'INV-1' },
      webhook_delivered_at: '2026-01-01'
    });

    const res = await POST(jsonRequest({}, authHeader()), { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toMatchObject({ id: 'export-1', exportFormat: 'json', webhookDelivered: true });
  });

  it('streams a real PDF buffer when format=pdf', async () => {
    supabase.from.mockReturnValue(createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid' }, error: null }));
    generatePdfExport.mockResolvedValue({ invoiceNumber: 'INV-1' });
    buildInvoicePdfBuffer.mockResolvedValue(Buffer.from('%PDF-1.4 fake'));

    const res = await POST(jsonRequest({ format: 'pdf' }, authHeader()), { params });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('invoice-INV-1.pdf');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString('utf8').startsWith('%PDF-')).toBe(true);
  });
});

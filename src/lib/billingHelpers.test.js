import { describe, it, expect, vi, afterEach } from 'vitest';
import supabase from './supabaseClient.js';
import { generateAccountingExport } from './accountingExportService.js';
import { createMockQueryBuilder } from '../testUtils/mockQueryBuilder.js';
import { markBillPaid } from './billingHelpers.js';

vi.mock('./supabaseClient.js', () => ({ default: { from: vi.fn() } }));
vi.mock('./accountingExportService.js', () => ({ generateAccountingExport: vi.fn().mockResolvedValue({}) }));

describe('markBillPaid', () => {
  afterEach(() => vi.clearAllMocks());

  it('marks a pending bill paid, triggers the export, and emits bill_update', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid', customer_id: 'cust-1' }, error: null });
    supabase.from.mockReturnValue(builder);
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const io = { to };

    const result = await markBillPaid({ billId: 'bill-1', paymentId: 'pay_1', io });

    expect(result).toMatchObject({ id: 'bill-1', status: 'paid' });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', razorpay_payment_id: 'pay_1' }));
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(generateAccountingExport).toHaveBeenCalledWith('bill-1');
    expect(to).toHaveBeenCalledWith(['role-manager', 'role-owner', 'user-cust-1']);
    expect(emit).toHaveBeenCalledWith('bill_update', expect.objectContaining({ id: 'bill-1', status: 'paid' }));
  });

  it('returns null without side effects when another path already settled it (lost the race)', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    supabase.from.mockReturnValue(builder);

    const result = await markBillPaid({ billId: 'bill-1', paymentId: 'pay_1', io: null });

    expect(result).toBeNull();
    expect(generateAccountingExport).not.toHaveBeenCalled();
  });

  it('tolerates a null io (webhook path has no live socket server in some environments)', async () => {
    const builder = createMockQueryBuilder({ data: { id: 'bill-1', status: 'paid', customer_id: 'cust-1' }, error: null });
    supabase.from.mockReturnValue(builder);

    await expect(markBillPaid({ billId: 'bill-1', paymentId: 'pay_1', io: null })).resolves.toMatchObject({ id: 'bill-1' });
  });
});

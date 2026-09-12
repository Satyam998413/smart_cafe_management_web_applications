import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { generateAccountingExport, generatePdfExport, buildInvoicePdfBuffer } from '@/lib/accountingExportService.js';

// POST /api/bills/[id]/export/accounting — ported from billingController.js's
// exportBillToAccounting. The manual/on-demand counterpart to the automatic
// triggerAccountingExport call. format=json re-runs the full export (fires
// the org's webhook again); format=pdf streams a printable receipt back to
// the caller and records that a PDF was generated, without re-firing the
// webhook (that's for the payment event, not every re-download).
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const format = body.format || 'json';
    if (!['json', 'pdf'].includes(format)) {
      return NextResponse.json({ message: 'format must be json or pdf' }, { status: 400 });
    }

    const { data: bill, error } = await scopeToOrg(supabase.from('bills').select('id, status').eq('id', id), auth.orgId).maybeSingle();
    if (error) throw error;
    if (!bill) return NextResponse.json({ message: 'Bill not found' }, { status: 404 });
    if (bill.status === 'pending') {
      return NextResponse.json({ message: 'Bill must be paid (or company-charged) before it can be exported' }, { status: 400 });
    }

    if (format === 'pdf') {
      const payload = await generatePdfExport(id);
      const pdfBuffer = await buildInvoicePdfBuffer(payload);
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="invoice-${payload.invoiceNumber}.pdf"`
        }
      });
    }

    const exportRow = await generateAccountingExport(id);
    return NextResponse.json(
      {
        id: exportRow.id,
        exportFormat: exportRow.export_format,
        payload: exportRow.payload,
        webhookDelivered: Boolean(exportRow.webhook_delivered_at)
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to export bill to accounting', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

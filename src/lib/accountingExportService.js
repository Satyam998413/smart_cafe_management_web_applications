import PDFDocument from 'pdfkit';
import supabase from './supabaseClient.js';
import logger from './logger.js';

// Ported unchanged from server/src/services/accountingExportService.js.
// The generic export shape (plan Phase 5 / gaps doc §4): structured JSON any
// future Tally/Zoho/QuickBooks connector could map from, without this
// codebase committing to any of them yet.
export const buildInvoicePayload = async (billId) => {
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .select(
      '*, organization:organizations(id, name, contact_email), ' +
        'orders(*, items:order_items(*, menuItem:menu_items(name), orderItemOptions:order_item_options(*)))'
    )
    .eq('id', billId)
    .single();
  if (billError) throw billError;

  // Sequential per org, but NOT concurrency-safe — a real GST invoice
  // sequence needs a DB sequence or row lock, deliberately not built yet
  // since tenant geography / GST applicability is still an open question
  // (plan's open question #4). The `gst` block is reserved here so this
  // payload's shape won't need to change once that's answered.
  const { count, error: countError } = await supabase
    .from('accounting_exports')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', bill.org_id);
  if (countError) throw countError;
  const invoiceNumber = `INV-${bill.org_id.slice(0, 8)}-${(count || 0) + 1}`;

  const lineItems = (bill.orders || []).flatMap((order) =>
    (order.items || []).map((item) => ({
      description: item.menuItem?.name || 'Item',
      quantity: item.quantity,
      unitPrice: Number(item.price_at_purchase),
      lineTotal: Number(item.price_at_purchase) * item.quantity
    }))
  );

  return {
    invoiceNumber,
    billId: bill.id,
    orgId: bill.org_id,
    orgName: bill.organization?.name ?? null,
    orgContactEmail: bill.organization?.contact_email ?? null,
    issuedAt: bill.paid_at || new Date().toISOString(),
    paymentMethod: bill.payment_method,
    lineItems,
    totalAmount: Number(bill.total_amount),
    gst: { applicable: false, taxBreakdown: [] }
  };
};

// A real, verifiable PDF (checked in tests via the %PDF- magic header, not
// just "did this throw") — generated on demand from the same JSON payload
// rather than persisted as a binary anywhere, so accounting_exports.payload
// stays the one source of truth and re-downloading a receipt never goes stale.
export const buildInvoicePdfBuffer = (payload) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(payload.orgName || 'Invoice');
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Invoice #${payload.invoiceNumber}`);
    doc.text(`Date: ${payload.issuedAt}`);
    doc.moveDown();

    payload.lineItems.forEach((item) => {
      doc.text(`${item.description}  x${item.quantity}   ${item.lineTotal.toFixed(2)}`);
    });

    doc.moveDown();
    doc.fontSize(12).text(`Total: ${payload.totalAmount.toFixed(2)}`, { align: 'right' });
    doc.end();
  });

// Best-effort — a failed delivery doesn't undo the export record, and a
// failed export doesn't undo the bill payment that triggered it.
const deliverWebhook = async (webhookUrl, payload) => {
  if (!webhookUrl) return null;
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    return response.ok ? new Date().toISOString() : null;
  } catch (error) {
    logger.error('Accounting webhook delivery failed', { webhookUrl, error: error.message });
    return null;
  }
};

const recordExport = async ({ orgId, billId, format, payload, webhookUrl = null, webhookDeliveredAt = null }) => {
  const { data, error } = await supabase
    .from('accounting_exports')
    .insert({
      org_id: orgId,
      bill_id: billId,
      export_format: format,
      payload,
      webhook_url: webhookUrl,
      webhook_delivered_at: webhookDeliveredAt
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

// The "system, triggered by bill payment" path (plan Phase 5) — called
// fire-and-forget from the bills collect-cash / webhooks/razorpay/bill-payment
// routes. Builds the JSON payload, fires the org's configured webhook if
// any, and records the export either way.
export const generateAccountingExport = async (billId) => {
  const payload = await buildInvoicePayload(billId);

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('accounting_webhook_url')
    .eq('id', payload.orgId)
    .maybeSingle();
  if (orgError) throw orgError;

  const webhookUrl = org?.accounting_webhook_url || null;
  const webhookDeliveredAt = await deliverWebhook(webhookUrl, payload);

  return recordExport({ orgId: payload.orgId, billId, format: 'json', payload, webhookUrl, webhookDeliveredAt });
};

// The on-demand "give me a printable receipt" path — records that a PDF was
// generated (audit trail) but never re-fires the accounting webhook, since
// that's specifically for the payment event, not every re-download.
export const generatePdfExport = async (billId) => {
  const payload = await buildInvoicePayload(billId);
  await recordExport({ orgId: payload.orgId, billId, format: 'pdf', payload });
  return payload;
};

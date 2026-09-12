import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { qrContextRateLimit } from '@/lib/publicRateLimit.js';

// GET /api/spaces/[id]/qr-context — ported from spaceController.js's
// getSpaceQrContext. Public, unauthenticated (plan Phase 3a): a guest who
// just scanned a QR hasn't logged in yet, so this is what the web/app page
// reads to show "You're ordering at <org>, <space>" before the name/email
// step, and is also what the client sends back as `spaceId` to
// /api/auth/register|customer-login to attach the QR context to their
// session. Deliberately returns only public-safe fields — no internal ids
// beyond the ones needed to place the order, no financial/staff data.
export async function GET(request, { params }) {
  const limited = qrContextRateLimit(request);
  if (limited) return limited;

  try {
    const { id } = await params;
    const { data: space, error } = await supabase
      .from('spaces')
      .select('id, kind, label, number, site:sites(id, name, organization:organizations(id, name, theme, premise_type))')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!space) return NextResponse.json({ message: 'That QR code is no longer valid' }, { status: 404 });

    const org = space.site.organization;
    return NextResponse.json({
      spaceId: space.id,
      spaceKind: space.kind,
      spaceLabel: space.label,
      spaceNumber: space.number,
      siteId: space.site.id,
      siteName: space.site.name,
      organization: org ? { id: org.id, name: org.name, theme: org.theme, premiseType: org.premise_type } : null
    });
  } catch (error) {
    logger.error('Failed to resolve QR context', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

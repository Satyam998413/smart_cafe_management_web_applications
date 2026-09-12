import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrganization } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';
import { THEME_PRESETS, resolveThemePreset } from '@/lib/themePresets.js';

// POST /api/admin/organizations/[id]/theme — ported from adminController.js's
// applyTheme. Master Admin only. Apply one of the 4 presets, or a fully
// custom { light, dark } token set.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { themePreset, customTheme } = await request.json();

    let theme;
    if (themePreset) {
      theme = resolveThemePreset(themePreset);
      if (!theme) {
        return NextResponse.json(
          { message: `Unknown themePreset. Choose one of: ${Object.keys(THEME_PRESETS).join(', ')}` },
          { status: 400 }
        );
      }
    } else if (customTheme && customTheme.light && customTheme.dark) {
      theme = customTheme;
    } else {
      return NextResponse.json({ message: 'Provide either themePreset or a customTheme with light and dark tokens' }, { status: 400 });
    }

    const { data, error } = await supabase.from('organizations').update({ theme }).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });

    await logAudit({
      orgId: id,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'theme_changed',
      targetType: 'organization',
      targetId: id,
      metadata: { themePreset: themePreset ?? 'custom' }
    });

    return NextResponse.json(serializeOrganization(data));
  } catch (error) {
    logger.error('Failed to apply theme', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

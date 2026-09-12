import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeMenuItemOptionGroup } from '@/lib/serializers.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { toChoiceRows } from '@/lib/menuHelpers.js';

// POST /api/menu/[id]/options — ported from menuController.js's
// createOptionGroup. Manager only. Creates the group and all its choices in
// one call, same as menuRoutes.js's `router.post('/:id/options', ...)`.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager');
  if (roleError) return roleError;

  try {
    const { id: menuItemId } = await params;
    const { name, selectionType, isRequired, choices } = await request.json();

    if (!name || !Array.isArray(choices) || choices.length === 0) {
      return NextResponse.json({ message: 'name and a non-empty choices array are required' }, { status: 400 });
    }
    if (selectionType && !['single', 'multiple'].includes(selectionType)) {
      return NextResponse.json({ message: 'selectionType must be single or multiple' }, { status: 400 });
    }

    const { data: group, error: groupError } = await supabase
      .from('menu_item_option_groups')
      .insert({
        menu_item_id: menuItemId,
        name,
        selection_type: selectionType || 'single',
        is_required: isRequired || false,
        ...(auth.orgId ? { org_id: auth.orgId } : {})
      })
      .select('*')
      .single();
    if (groupError) throw groupError;

    const { data: savedChoices, error: choicesError } = await supabase
      .from('menu_item_option_choices')
      .insert(toChoiceRows(choices, group.id))
      .select('*');
    if (choicesError) throw choicesError;

    return NextResponse.json(serializeMenuItemOptionGroup({ ...group, choices: savedChoices }), { status: 201 });
  } catch (error) {
    logger.error('Failed to create menu item option group', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

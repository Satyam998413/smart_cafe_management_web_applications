import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeMenuItemOptionGroup } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { toChoiceRows } from '@/lib/menuHelpers.js';

// PATCH /api/menu/options/[groupId] — ported from menuController.js's
// updateOptionGroup. Manager only. Updates the group's own fields and, if
// `choices` is supplied, replaces its whole choice list — matches a "save
// the whole group" edit-modal UX rather than fine-grained per-choice
// endpoints. Same as menuRoutes.js's `router.patch('/options/:groupId', ...)`.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager');
  if (roleError) return roleError;

  try {
    const { groupId } = await params;
    const { name, selectionType, isRequired, choices } = await request.json();

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (selectionType !== undefined) updates.selection_type = selectionType;
    if (isRequired !== undefined) updates.is_required = isRequired;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await scopeToOrg(
        supabase.from('menu_item_option_groups').update(updates).eq('id', groupId),
        auth.orgId
      );
      if (updateError) throw updateError;
    }

    if (Array.isArray(choices)) {
      const { error: deleteError } = await supabase
        .from('menu_item_option_choices')
        .delete()
        .eq('option_group_id', groupId);
      if (deleteError) throw deleteError;

      if (choices.length > 0) {
        const { error: insertError } = await supabase
          .from('menu_item_option_choices')
          .insert(toChoiceRows(choices, groupId));
        if (insertError) throw insertError;
      }
    }

    const { data: group, error: fetchError } = await scopeToOrg(
      supabase.from('menu_item_option_groups').select('*, choices:menu_item_option_choices(*)').eq('id', groupId),
      auth.orgId
    ).maybeSingle();
    if (fetchError) throw fetchError;
    if (!group) return NextResponse.json({ message: 'Option group not found' }, { status: 404 });

    return NextResponse.json(
      serializeMenuItemOptionGroup({
        ...group,
        choices: [...(group.choices || [])].sort((a, b) => a.sort_order - b.sort_order)
      })
    );
  } catch (error) {
    logger.error('Failed to update menu item option group', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/menu/options/[groupId] — ported from menuController.js's
// deleteOptionGroup. Manager only. Cascade-deletes its choices via the FK's
// `on delete cascade`.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager');
  if (roleError) return roleError;

  try {
    const { groupId } = await params;
    const { error } = await scopeToOrg(
      supabase.from('menu_item_option_groups').delete().eq('id', groupId),
      auth.orgId
    );
    if (error) throw error;
    return NextResponse.json({ message: 'Option group deleted' });
  } catch (error) {
    logger.error('Failed to delete menu item option group', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

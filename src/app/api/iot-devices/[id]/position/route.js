import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeDevice } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

const clampPercent = (value) => Math.min(100, Math.max(0, Number(value)));

// PATCH /api/iot-devices/[id]/position — persists where a device's icon sits
// on its space's floor-plan canvas (src/features/iot/SpaceLayoutCanvas.jsx).
// Same auth gate as .../commands, but this is a plain column update, not a
// device_commands-audited hardware action — repositioning an icon is a
// layout preference, not something the physical device needs to know about.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { posX, posY } = await request.json();
    if (posX === undefined || posY === undefined || Number.isNaN(Number(posX)) || Number.isNaN(Number(posY))) {
      return NextResponse.json({ message: 'posX and posY are required numbers' }, { status: 400 });
    }

    const { data: device, error: deviceError } = await scopeToOrg(
      supabase.from('devices').select('id').eq('id', id),
      auth.orgId
    ).maybeSingle();
    if (deviceError) throw deviceError;
    if (!device) return NextResponse.json({ message: 'Device not found' }, { status: 404 });

    if (auth.userRole === 'manager') {
      const { data: actor, error: actorError } = await supabase
        .from('users')
        .select('permissions')
        .eq('id', auth.userId)
        .maybeSingle();
      if (actorError) throw actorError;
      if (!actor?.permissions?.canControlIot) {
        return NextResponse.json({ message: 'IoT control has not been granted to you by the Owner' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('devices')
      .update({ pos_x: clampPercent(posX), pos_y: clampPercent(posY) })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeDevice(data));
  } catch (error) {
    logger.error('Failed to update IoT device position', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

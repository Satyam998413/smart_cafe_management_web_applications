import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/attendance/summary?year=2026&month=9&userId=...
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    const targetUserId = searchParams.get('userId');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear(), 10);
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1), 10);

    // Compute month date range
    const startDateIso = new Date(year, month - 1, 1).toISOString();
    const endDateIso = new Date(year, month, 0, 23, 59, 59).toISOString();

    // 1. Fetch attendance logs for month
    let query = supabase
      .from('attendance_logs')
      .select('*, user:users(name, email, role)')
      .eq('org_id', targetOrgId)
      .gte('timestamp', startDateIso)
      .lte('timestamp', endDateIso);

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: logs, error: logsErr } = await query;
    if (logsErr && logsErr.code !== 'PGRST205') throw logsErr;

    // 2. Fetch staff shifts
    const { data: shifts } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('org_id', targetOrgId);

    const shiftMap = new Map((shifts || []).map(s => [s.user_id, s]));

    // 3. Fetch approved leaves for month
    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('org_id', targetOrgId)
      .eq('final_status', 'approved');

    // Aggregate monthly hours & late minutes per user
    const userStatsMap = new Map();

    const todayStr = new Date().toISOString().substring(0, 10);
    let todayLateCount = 0;
    let todayOnLeaveCount = 0;
    let todayPresentCount = 0;

    const todayLogs = (logs || []).filter(l => l.timestamp && l.timestamp.startsWith(todayStr));
    const presentUserIds = new Set(todayLogs.map(l => l.user_id));
    todayPresentCount = presentUserIds.size;

    todayLateCount = todayLogs.filter(l => l.is_late || (l.late_minutes && l.late_minutes > 0)).length;

    if (leaves) {
      todayOnLeaveCount = leaves.filter(l => {
        const start = l.start_date;
        const end = l.end_date;
        return todayStr >= start && todayStr <= end;
      }).length;
    }

    (logs || []).forEach(log => {
      const uid = log.user_id;
      if (!userStatsMap.has(uid)) {
        userStatsMap.set(uid, {
          userId: uid,
          userName: log.user?.name || 'Staff Member',
          userRole: log.user?.role || 'staff',
          totalLateMinutes: 0,
          totalOvertimeMinutes: 0,
          totalPunches: 0,
          logs: []
        });
      }

      const stat = userStatsMap.get(uid);
      stat.totalPunches += 1;
      stat.totalLateMinutes += log.late_minutes || 0;
      stat.totalOvertimeMinutes += log.overtime_minutes || 0;
      stat.logs.push(log);
    });

    // Calculate required monthly hours (assume ~22 working days * 8h = 176h default)
    const daysInMonth = new Date(year, month, 0).getDate();
    const workingDaysInMonth = Math.floor(daysInMonth * (5 / 7)); // approx 5 working days per week
    const defaultRequiredHours = workingDaysInMonth * 8; // e.g. 176 hours

    const userSummaries = Array.from(userStatsMap.values()).map(stat => {
      const shift = shiftMap.get(stat.userId);
      const reqDailyHours = shift?.required_daily_hours || 8.0;
      const totalRequiredHours = workingDaysInMonth * reqDailyHours;

      // Estimate total worked hours (punches * avg shift hours or total overtime / punch durations)
      const estimatedWorkedHours = Math.round((stat.totalPunches / 2) * reqDailyHours + (stat.totalOvertimeMinutes / 60));

      let monthlyStatus = 'green'; // 'green' | 'red' | 'orange'
      if (estimatedWorkedHours < totalRequiredHours) {
        monthlyStatus = 'red';
      } else if (stat.totalOvertimeMinutes > 60 || estimatedWorkedHours > totalRequiredHours) {
        monthlyStatus = 'orange';
      } else {
        monthlyStatus = 'green';
      }

      return {
        ...stat,
        requiredMonthlyHours: totalRequiredHours,
        totalWorkedHours: estimatedWorkedHours,
        monthlyStatus
      };
    });

    return NextResponse.json({
      year,
      month,
      dashboardStats: {
        todayLateCount,
        todayOnLeaveCount,
        todayPresentCount,
        totalStaff: userSummaries.length || 1
      },
      userSummaries
    });
  } catch (error) {
    logger.error('Failed to compute attendance summary', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

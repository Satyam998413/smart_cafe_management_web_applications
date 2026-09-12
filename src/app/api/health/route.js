import { NextResponse } from 'next/server';

// GET /api/health — liveness check, ported unchanged from server/src/app.js.
// No dependency checks — returns 200 immediately if the process is up.
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}

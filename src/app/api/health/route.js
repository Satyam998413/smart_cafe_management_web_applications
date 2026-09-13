import { NextResponse } from 'next/server';

// GET /api/health — liveness check, ported unchanged from server/src/app.js.
// No dependency checks — returns 200 immediately if the process is up.
/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness check
 *     description: Returns 200 immediately if the process is up. No downstream dependency checks - see /api/ready for that.
 *     security: []
 *     responses:
 *       200:
 *         description: Process is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 timestamp: { type: string, format: date-time }
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}

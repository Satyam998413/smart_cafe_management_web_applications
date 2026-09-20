import { NextResponse } from 'next/server';

// Wildcard origin matches server.js's Socket.IO CORS config — auth is a
// Bearer token (never cookies), so reflecting '*' carries no credential risk.
// Needed for flutter_app's web target and react_app's dev server, both of
// which call this API from a different origin/port.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function proxy(request) {
  if (request.method === 'OPTIONS') {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};

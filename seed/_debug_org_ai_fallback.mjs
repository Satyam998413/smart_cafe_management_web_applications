import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { getAdminClient } from './lib/supabaseAdmin.js';

const BASE = 'http://127.0.0.1:3000/api';
const client = getAdminClient();

const results = [];
const check = (label, cond, extra = '') => {
  results.push({ label, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${label}${extra ? ' :: ' + extra : ''}`);
};

let orgId;
try {
  const { data: org } = await client
    .from('organizations')
    .insert({ name: 'Debug Org AI Fallback', premise_type: 'cafe_restaurant', contact_email: 'debug-ai-fallback@example.invalid', plan_tier: 'standard' })
    .select('id')
    .single();
  orgId = org.id;

  const { data: owner } = await client
    .from('users')
    .insert({ name: 'Debug Owner', email: 'debug-ai-fallback-owner@example.invalid', role: 'owner', org_id: orgId })
    .select('id')
    .single();

  const { data: masterAdmin } = await client.from('users').select('id').eq('email', 'master.admin@smartcafe.test').maybeSingle();
  const token = jwt.sign({ userId: masterAdmin.id, role: 'master_admin', orgId: null, isMasterAdmin: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const createRes = await fetch(`${BASE}/admin/organizations/${orgId}/ai-credentials`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider: 'openrouter', apiKey: 'fake-key', model: 'test-model' })
  });
  const created = await createRes.json();
  check('POST succeeds despite missing owner_id column', createRes.status === 201, JSON.stringify(created));
  check('response has ownerId:null fallback shape (not a crash)', created.ownerId === null || created.ownerId === owner.id, JSON.stringify(created));

  const listRes = await fetch(`${BASE}/admin/organizations/${orgId}/ai-credentials`, { headers });
  const list = await listRes.json();
  check('GET list succeeds despite missing owner_id column', listRes.status === 200 && list.length === 1, JSON.stringify(list));

  const toggleRes = await fetch(`${BASE}/admin/organizations/${orgId}/ai-credentials/${created.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isActive: false })
  });
  const toggled = await toggleRes.json();
  check('PATCH succeeds despite missing owner_id column', toggleRes.status === 200 && toggled.isActive === false, JSON.stringify(toggled));
} catch (e) {
  console.error('debug script error:', e);
  results.push({ label: 'no crash', ok: false });
} finally {
  if (orgId) {
    await client.from('org_ai_credentials').delete().eq('org_id', orgId);
    await client.from('users').delete().eq('org_id', orgId);
    await client.from('organizations').delete().eq('id', orgId);
    console.log('cleanup done');
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.label).join(' | '));
  process.exit(1);
}

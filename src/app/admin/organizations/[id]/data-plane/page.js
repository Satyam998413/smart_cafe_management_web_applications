'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import Button from '@/components/ui/Button';

// Plan Phase 8 — Enterprise BYO-Supabase tier. Switching here doesn't
// migrate any existing data between projects (a real, separate, one-off
// operation), per the API route's own doc comment.
export default function OrgDataPlanePage() {
  const { org, apiFetch, reload } = useOrgDetail();
  const [dataPlaneType, setDataPlaneType] = useState(org.dataPlaneType);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (dataPlaneType === 'byo_supabase' && (!supabaseUrl || !anonKey)) {
      setError('supabaseUrl and anonKey are both required for byo_supabase.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/data-plane`, {
        method: 'PATCH',
        ...jsonBody({
          dataPlaneType,
          ...(dataPlaneType === 'byo_supabase' ? { supabaseUrl, anonKey } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to update the data plane.');
        return;
      }
      await reload();
      setSupabaseUrl('');
      setAnonKey('');
      setSaved(true);
    } catch (e) {
      console.error('Failed to update data plane:', e);
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 560 }}>
      <div>
        <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Data plane</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Currently: <strong>{org.dataPlaneType === 'byo_supabase' ? 'BYO-Supabase (Enterprise)' : 'Shared platform database'}</strong>
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        {[
          { value: 'shared', label: 'Shared' },
          { value: 'byo_supabase', label: 'BYO-Supabase' }
        ].map((opt) => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input type="radio" name="data-plane-type" value={opt.value} checked={dataPlaneType === opt.value} onChange={() => setDataPlaneType(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>

      {dataPlaneType === 'byo_supabase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)' }}>
          <div>
            <label className="field-label" htmlFor="dp-url">
              Supabase project URL
            </label>
            <input id="dp-url" type="url" className="field-input" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
          </div>
          <div>
            <label className="field-label" htmlFor="dp-key">
              Anon key
            </label>
            <input id="dp-key" type="password" className="field-input" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} />
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Encrypted at rest. Cross-tenant analytics aren&rsquo;t available for BYO tenants without a separate reporting layer.
          </p>
        </div>
      )}

      {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button type="submit" variant="primary" loading={saving} disabled={saving}>
          {saving ? 'Saving…' : 'Save data plane'}
        </Button>
        {saved && (
          <span style={{ color: '#047857', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Check size={15} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

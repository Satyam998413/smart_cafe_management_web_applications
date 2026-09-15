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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '1.75rem', width: '100%', alignItems: 'flex-start' }}>
      <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            Data Plane Architecture
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.5rem' }}>
            Currently: <strong>{org.dataPlaneType === 'byo_supabase' ? 'BYO-Supabase (Enterprise Isolated)' : 'Shared Platform Database (Multi-Tenant RLS)'}</strong>
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            { value: 'shared', label: 'Shared Database', desc: 'Standard multi-tenant schema with automated row level security' },
            { value: 'byo_supabase', label: 'BYO-Supabase', desc: 'Isolated dedicated Supabase project for enterprise data sovereignty' }
          ].map((opt) => {
            const isSelected = dataPlaneType === opt.value;
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--accent-wash)' : 'var(--bg-surface-elevated)',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="radio" name="data-plane-type" value={opt.value} checked={isSelected} onChange={() => setDataPlaneType(opt.value)} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{opt.label}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{opt.desc}</span>
              </label>
            );
          })}
        </div>

        {dataPlaneType === 'byo_supabase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)' }}>
            <div>
              <label className="field-label" htmlFor="dp-url">
                Supabase Project URL
              </label>
              <input id="dp-url" type="url" className="field-input" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://xxxx.supabase.co" required={dataPlaneType === 'byo_supabase'} />
            </div>
            <div>
              <label className="field-label" htmlFor="dp-key">
                Anon API Key
              </label>
              <input id="dp-key" type="password" className="field-input" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJh..." required={dataPlaneType === 'byo_supabase'} />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Credentials are encrypted at rest using AES-256-GCM prior to storage in vault metadata.
            </p>
          </div>
        )}

        {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? 'Saving…' : 'Save data plane'}
          </Button>
          {saved && (
            <span style={{ color: '#047857', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
              <Check size={15} /> Saved
            </span>
          )}
        </div>
      </form>

      <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          Enterprise BYO-Supabase Guide
        </h2>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p>
            When BYO-Supabase is selected, all real-time order streams, menu catalogs, staff records, and guest bookings query the dedicated Supabase instance directly.
          </p>
          <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Storage Bucket Requirements:</span>
            Ensure bucket <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>cremen_media</code> is created with 3MB upload limits for user images.
          </div>
        </div>
      </div>
    </div>
  );
}

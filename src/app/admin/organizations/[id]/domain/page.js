'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { jsonBody } from '@/lib/apiClient';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import Button from '@/components/ui/Button';

// Plan Phase 1c — custom_domain resolution happens at the edge from this
// one field; this page is just where Master Admin sets it.
export default function OrgDomainPage() {
  const { org, apiFetch, reload } = useOrgDetail();
  const [domain, setDomain] = useState(org.customDomain || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/organizations/${org.id}/domain`, {
        method: 'PATCH',
        ...jsonBody({ customDomain: domain })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to set the custom domain.');
        return;
      }
      await reload();
      setSaved(true);
    } catch (e) {
      console.error('Failed to set custom domain:', e);
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
            White-Label Custom Domain
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.5rem' }}>
            The domain this tenant&rsquo;s web application resolves under once CNAME/A records point here.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="domain-input">
            Target Custom Domain
          </label>
          <input
            id="domain-input"
            type="text"
            className="field-input"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setSaved(false);
            }}
            placeholder="cafe.example.com"
            required
          />
        </div>

        {error && <div style={{ color: 'var(--status-cancelled)', fontSize: '0.85rem' }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {saving ? 'Saving…' : 'Save domain'}
          </Button>
          {saved && (
            <span style={{ color: '#047857', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
              <Check size={15} /> Domain configured
            </span>
          )}
        </div>
      </form>

      <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          DNS Routing & SSL Instructions
        </h2>

        <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DNS CNAME Record</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
            {domain || 'yourdomain.com'} CNAME app.cremen.io
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '2px' }}>
            SSL certificates and wildcard edge routing are issued automatically upon HTTP challenge resolution.
          </p>
        </div>
      </div>
    </div>
  );
}

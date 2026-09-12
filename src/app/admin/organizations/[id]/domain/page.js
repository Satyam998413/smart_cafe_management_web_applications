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
    <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 560 }}>
      <div>
        <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Custom domain</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          The domain this tenant&rsquo;s white-labeled web app resolves under, once DNS points here.
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="domain-input">
          Domain
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button type="submit" variant="primary" loading={saving} disabled={saving}>
          {saving ? 'Saving…' : 'Save domain'}
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

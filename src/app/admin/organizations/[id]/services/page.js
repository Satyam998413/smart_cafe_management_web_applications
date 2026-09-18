'use client';

import { useEffect, useState } from 'react';
import { Sliders, Cpu, Lock, Fingerprint, Package, Receipt, CheckCircle2, Save, RefreshCw } from 'lucide-react';
import { useOrgDetail } from '@/features/admin/OrgDetailContext';
import Button from '@/components/ui/Button';

export default function OrgServicesPage() {
  const { org, apiFetch, reload } = useOrgDetail();
  const [services, setServices] = useState({
    iot_enabled: true,
    smart_locks_enabled: true,
    punching_system_enabled: true,
    inventory_enabled: true,
    billing_connector_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    fetchServices();
  }, [org?.id]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/services-control?orgId=${org.id}`);
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error('Failed to load org services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setServices((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await apiFetch('/services-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: org.id,
          ...services
        })
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        reload(true);
      }
    } catch (err) {
      console.error('Failed to save service configuration:', err);
    } finally {
      setSaving(false);
    }
  };

  const featureDefs = [
    { key: 'iot_enabled', label: 'IoT Multi-Channel Relay Controllers', icon: Cpu, desc: 'Enables 4-combination Wi-Fi relay switches (ESP32/Tuya) for equipment on/off' },
    { key: 'smart_locks_enabled', label: 'Smart Lock Security System', icon: Lock, desc: 'Enables Wi-Fi, RFID cards, keypad PINs, and remote open capabilities' },
    { key: 'punching_system_enabled', label: 'Biometric & AI Face Recognition Attendance', icon: Fingerprint, desc: 'Enables staff punching via RFID, Fingerprint, or AI Face Recognition' },
    { key: 'inventory_enabled', label: 'Smart Food Inventory & Expiry Engine', icon: Package, desc: 'Enables stock quantities, batch expiry tracking, and BOM recipe deductions' },
    { key: 'billing_connector_enabled', label: 'POS & Billing Connectors', icon: Receipt, desc: 'Enables Razorpay checkout, Cash billing collection, and Tally accounting sync' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      <div className="glass-card" style={{ padding: '1.5rem 1.75rem', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Sliders size={22} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Organization Services & Feature Switchboard
          </h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Master Admin control panel to enable or disable specific hardware & software features for <strong>{org?.name}</strong>.
        </p>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
            Loading organization service flags...
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {featureDefs.map((def) => {
                const Icon = def.icon;
                const isEnabled = !!services[def.key];

                return (
                  <div
                    key={def.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1.25rem 1.5rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 'var(--radius-md)',
                          background: isEnabled ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                          color: isEnabled ? '#10b981' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: isEnabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)'
                        }}
                      >
                        <Icon size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{def.label}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{def.desc}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(def.key)}
                      style={{
                        position: 'relative',
                        width: 50,
                        height: 26,
                        borderRadius: 13,
                        background: isEnabled ? '#10b981' : 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: isEnabled ? 26 : 2,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {savedSuccess ? (
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} /> Services configuration saved!
                </div>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Controls live features available to tenant owners, managers, and staff
                </span>
              )}

              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Services Switchboard'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

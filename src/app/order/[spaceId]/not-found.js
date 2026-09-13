import Link from 'next/link';
import { QrCode } from 'lucide-react';

// Segment-level 404 (Next.js App Router convention) for this route — hit
// when GuestOrderPage's own lookup calls notFound() because the spaceId in
// the URL doesn't resolve to a real space (deleted space, mistyped/stale QR
// code, or a QR printed for a space that's since been removed). A real
// styled page rather than a crash/blank screen, per this change's own
// "guest's first impression of the product" standard — this is the only
// state without an org to theme against, so it uses the app's default amber
// palette rather than the per-space CSS custom-property overrides in
// page.js.
export default function SpaceNotFound() {
  return (
    <div className="app-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-card" style={{ width: '90%', maxWidth: '380px', padding: '2.5rem', textAlign: 'center' }}>
        <div className="brand-icon" style={{ margin: '0 auto 1.25rem' }}>
          <QrCode size={24} color="var(--text-on-accent)" />
        </div>
        <h1 className="brand-title" style={{ fontSize: '1.3rem', marginBottom: '0.6rem' }}>
          That QR code is no longer valid
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
          This table or ordering point may have been removed, or the code was mistyped. Ask a staff member for a fresh QR code, or sign in directly below.
        </p>
        <Link href="/" className="text-link" style={{ fontSize: '0.9rem' }}>
          Go to sign in →
        </Link>
      </div>
    </div>
  );
}

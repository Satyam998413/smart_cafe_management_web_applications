import Link from 'next/link';
import { Hotel } from 'lucide-react';

// Segment-level 404 (Next.js App Router convention) for this route — hit
// when StayPage's own lookup calls notFound() because the siteId in the URL
// doesn't resolve to a real site (deleted site, mistyped/stale link, or a
// link shared for a site that's since been removed). Mirrors
// src/app/order/[spaceId]/not-found.js's shape/standard exactly — a real
// styled page, not a crash/blank screen, using the app's default amber
// palette since there's no org to theme against here either.
export default function StayNotFound() {
  return (
    <div className="app-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-card" style={{ width: '90%', maxWidth: '380px', padding: '2.5rem', textAlign: 'center' }}>
        <div className="brand-icon" style={{ margin: '0 auto 1.25rem' }}>
          <Hotel size={24} color="var(--text-on-accent)" />
        </div>
        <h1 className="brand-title" style={{ fontSize: '1.3rem', marginBottom: '0.6rem' }}>
          That property link is no longer valid
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
          This property may have been removed, or the link was mistyped. Double-check the link you were given, or sign in directly below.
        </p>
        <Link href="/" className="text-link" style={{ fontSize: '0.9rem' }}>
          Go to sign in →
        </Link>
      </div>
    </div>
  );
}

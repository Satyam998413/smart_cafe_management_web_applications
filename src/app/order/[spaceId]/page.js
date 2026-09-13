import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Building2, Coffee, Hotel } from 'lucide-react';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { SITE_URL } from '@/lib/siteUrl.js';
import GuestOrderForm from './GuestOrderForm';

// The public-facing guest QR landing page (plan/flutter-app-master-plan.md:
// "QR opens a web page by default. If the tenant's native app is installed,
// redirect into the app instead") — the piece that was entirely missing
// before this change. GET /api/spaces/[id]/qr-context already resolves a
// spaceId to org/site/space for flutter_app's deep-link flow; this is that
// same resolution done as a Server Component instead of a client fetch to
// our own route, so the page is actually server-rendered (no client-only
// shell, no loading flash) and can carry real per-request <title>/JSON-LD.
//
// Queries Supabase directly rather than fetching qr-context over HTTP —
// this avoids an unnecessary self-referential round trip, and this page
// needs a few public-safe fields qr-context deliberately omits (site
// address/lat/lng, org logo/seo_description) for the structured-data block
// below.
const PREMISE_ICON = { cafe_restaurant: Coffee, hotel: Hotel, company_office: Building2 };
const SCHEMA_TYPE_BY_PREMISE = { cafe_restaurant: 'CafeOrCoffeeShop', hotel: 'LodgingBusiness', company_office: 'LocalBusiness' };

// Fallback palette for an org that never set a theme (organizations.theme
// defaults to `{}` when no preset/custom colors were chosen — see
// POST /api/admin/organizations) — same amber brand as globals.css's :root,
// given both a light and dark variant since this page (unlike the rest of
// the app today) actually honors prefers-color-scheme.
const DEFAULT_THEME = {
  light: { primary: '#d97706', secondary: '#92400e', accent: '#fdba74', surface: '#ffffff', onSurface: '#1c1917' },
  dark: { primary: '#f59e0b', secondary: '#fdba74', accent: '#92400e', surface: '#231b12', onSurface: '#faf7f2' }
};

// Theme colors are only ever written via authenticated admin/owner routes
// (see POST /api/admin/organizations/[id]/theme) with no color-format
// validation there today — trusted input, but still stripped of anything
// that couldn't be a plain hex/CSS color token before landing in the raw
// <style> string below.
const safeHex = (value, fallback) => (/^#[0-9a-fA-F]{3,8}$/.test(String(value ?? '').trim()) ? String(value).trim() : fallback);

const hexToRgba = (hex, alpha) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const relativeLuminance = (hex) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Maps an org's { primary, secondary, accent, surface, onSurface } palette
// onto the same CSS custom property names globals.css's :root already
// defines (--accent-primary, --bg-card, --text-primary, ...) — every shared
// primitive this page reuses (Button, .field-input, .glass-card) already
// reads those exact var names, so re-declaring them scoped to this page is
// enough to re-theme those components with zero changes to the components
// themselves.
const buildTokens = (rawPalette, fallback) => {
  const primary = safeHex(rawPalette.primary, fallback.primary);
  const secondary = safeHex(rawPalette.secondary, fallback.secondary);
  const accent = safeHex(rawPalette.accent, fallback.accent);
  const surface = safeHex(rawPalette.surface, fallback.surface);
  const onSurface = safeHex(rawPalette.onSurface, fallback.onSurface);
  const onAccent = relativeLuminance(primary) > 0.6 ? '#1c1917' : '#fffaf2';

  return {
    '--accent-primary': primary,
    '--accent-secondary': secondary,
    '--accent-soft': accent,
    '--accent-glow': hexToRgba(primary, 0.22),
    '--accent-wash': hexToRgba(primary, 0.1),
    '--bg-page': surface,
    '--bg-surface': surface,
    '--bg-surface-elevated': hexToRgba(onSurface, 0.05),
    '--bg-card': hexToRgba(surface, 0.82),
    '--bg-card-solid': surface,
    '--border': hexToRgba(onSurface, 0.1),
    '--border-strong': hexToRgba(onSurface, 0.18),
    '--border-focus': hexToRgba(primary, 0.5),
    '--text-primary': onSurface,
    '--text-secondary': hexToRgba(onSurface, 0.72),
    '--text-muted': hexToRgba(onSurface, 0.5),
    '--text-on-accent': onAccent,
    '--shadow-accent': `0 10px 26px ${hexToRgba(primary, 0.28)}`
  };
};

const cssBlock = (selector, tokens) =>
  `${selector}{${Object.entries(tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join('')}}`;

// Cached per-request (React's `cache()`) so generateMetadata and the page
// component share one Supabase round trip instead of two.
const getSpaceContext = cache(async (spaceId) => {
  const { data: space, error } = await supabase
    .from('spaces')
    .select(
      `id, kind, label, number, is_bookable,
       site:sites(id, name, address, lat, lng, google_business_profile_url,
         organization:organizations(id, name, theme, premise_type, logo_url, seo_description, allow_ai_crawlers))`
    )
    .eq('id', spaceId)
    .maybeSingle();

  // A malformed spaceId (not a UUID) comes back as a Postgres error, not a
  // clean null — both cases mean "no such QR code" to the guest.
  if (error) {
    logger.error('Failed to resolve guest order page space', { spaceId, error: error.message });
    return null;
  }
  if (!space || !space.site || !space.site.organization) return null;
  return space;
});

export async function generateMetadata({ params }) {
  const { spaceId } = await params;
  const space = await getSpaceContext(spaceId);
  if (!space) return { title: 'QR code not found — Smart Cafe Manager' };

  const org = space.site.organization;
  const title = `Order at ${org.name} — ${space.label}`;
  const description =
    org.seo_description?.trim() ||
    `Order ahead at ${org.name}${space.site.name ? `, ${space.site.name}` : ''}. Scan, browse the menu, and order in seconds.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/order/${spaceId}` },
    // allow_ai_crawlers only ever gates the *AI-crawler* user agents in
    // robots.js — it deliberately does not affect standard search engine
    // indexing, so this page's own metadata stays permissive regardless.
    openGraph: { title, description, images: org.logo_url ? [org.logo_url] : undefined }
  };
}

export default async function GuestOrderPage({ params }) {
  const { spaceId } = await params;
  const space = await getSpaceContext(spaceId);
  if (!space) notFound();

  const org = space.site.organization;
  const site = space.site;
  const theme = org.theme && typeof org.theme === 'object' ? org.theme : {};
  const Icon = PREMISE_ICON[org.premise_type] || Coffee;

  // Scoped by a data-attribute (not inline `style`) specifically so the
  // dark-mode media-query rule below can win over the light rule when the
  // OS is in dark mode — an inline `style` attribute would always beat a
  // stylesheet rule regardless of @media, which would make prefers-color-
  // scheme silently do nothing.
  const selector = `[data-guest-space="${spaceId}"]`;
  const lightTokens = buildTokens(theme.light || {}, DEFAULT_THEME.light);
  const darkTokens = buildTokens(theme.dark || {}, DEFAULT_THEME.dark);
  const themeCss = `${cssBlock(selector, lightTokens)}@media (prefers-color-scheme: dark){${cssBlock(selector, darkTokens)}}`;

  // schema.org structured data (plan Phase 10B) — Google explicitly
  // documents that JSON-LD does not need to live inside <head> (it's valid
  // anywhere in the document); the App Router's metadata API has no hook
  // for injecting an arbitrary <script> into <head> from a nested page, only
  // typed fields via generateMetadata, so this renders in the body, which
  // is the standard place Next.js apps embed JSON-LD in practice.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE_BY_PREMISE[org.premise_type] || 'LocalBusiness',
    name: org.name,
    ...(org.logo_url ? { image: org.logo_url, logo: org.logo_url } : {}),
    ...(site.address ? { address: { '@type': 'PostalAddress', streetAddress: site.address } } : {}),
    ...(site.lat != null && site.lng != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: Number(site.lat), longitude: Number(site.lng) } }
      : {}),
    ...(site.google_business_profile_url ? { sameAs: [site.google_business_profile_url] } : {}),
    url: `${SITE_URL}/order/${spaceId}`
  };

  return (
    <div className="guest-shell" data-guest-space={spaceId}>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="guest-card glass-card">
        <div className="guest-brand-row">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={`${org.name} logo`} className="guest-logo" />
          ) : (
            <div className="guest-logo guest-logo-fallback brand-icon">
              <Icon size={26} strokeWidth={2} color="var(--text-on-accent)" />
            </div>
          )}
          <div>
            <h1 className="guest-org-name brand-title">{org.name}</h1>
            <p className="guest-space-label">
              Ordering at {org.name} — {space.label}
              {site.name ? ` · ${site.name}` : ''}
            </p>
          </div>
        </div>

        <GuestOrderForm spaceId={spaceId} />
      </div>
    </div>
  );
}

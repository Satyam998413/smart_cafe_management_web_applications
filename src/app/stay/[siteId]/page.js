import { cache } from 'react';
import { notFound } from 'next/navigation';
import { BedDouble, Hotel } from 'lucide-react';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { SITE_URL } from '@/lib/siteUrl.js';
import StayBookingForm from './StayBookingForm';

// The public-facing guest room-browsing/booking landing page — a hotel-site
// analogue of src/app/order/[spaceId]/page.js's guest QR ordering page.
// That page resolves one *space* (a table) to its org for dine-in ordering;
// this one resolves a whole *site* (a property) for room booking, since a
// guest picking a stay is choosing among every room at one site, not
// walking up to one already-known table. Same reasoning applies here as
// there: query Supabase directly rather than round-tripping through our own
// API, real server-rendered per-request <title>/JSON-LD, not a client-only
// shell.
const SCHEMA_TYPE_BY_PREMISE = { hotel: 'LodgingBusiness', cafe_restaurant: 'CafeOrCoffeeShop', company_office: 'LocalBusiness' };

// Same fallback palette as order/[spaceId]/page.js's DEFAULT_THEME — kept as
// its own copy rather than importing from that file (which doesn't export
// these helpers) to keep this page's "zero collision risk" isolation from
// that other guest flow real, not just nominal.
const DEFAULT_THEME = {
  light: { primary: '#d97706', secondary: '#92400e', accent: '#fdba74', surface: '#ffffff', onSurface: '#1c1917' },
  dark: { primary: '#f59e0b', secondary: '#fdba74', accent: '#92400e', surface: '#231b12', onSurface: '#faf7f2' }
};

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

// Cached per-request so generateMetadata and the page component share one
// Supabase round trip instead of two (same pattern as order/[spaceId]'s
// getSpaceContext).
const getSiteContext = cache(async (siteId) => {
  const { data: site, error } = await supabase
    .from('sites')
    .select(
      `id, name, address, lat, lng, google_business_profile_url,
       organization:organizations(id, name, theme, premise_type, logo_url, seo_description, allow_ai_crawlers)`
    )
    .eq('id', siteId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to resolve stay page site', { siteId, error: error.message });
    return null;
  }
  if (!site || !site.organization) return null;
  return site;
});

export async function generateMetadata({ params }) {
  const { siteId } = await params;
  const site = await getSiteContext(siteId);
  if (!site) return { title: 'Property not found — Smart Cafe Manager' };

  const org = site.organization;
  const title = `Book a stay at ${org.name}${site.name ? ` — ${site.name}` : ''}`;
  const description =
    org.seo_description?.trim() ||
    `Browse rooms and book your stay at ${org.name}${site.name ? `, ${site.name}` : ''} — pick your dates, choose a room, and pay online or at check-in.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/stay/${siteId}` },
    openGraph: { title, description, images: org.logo_url ? [org.logo_url] : undefined }
  };
}

export default async function StayPage({ params }) {
  const { siteId } = await params;
  const site = await getSiteContext(siteId);
  if (!site) notFound();

  const org = site.organization;
  const theme = org.theme && typeof org.theme === 'object' ? org.theme : {};
  const Icon = org.premise_type === 'hotel' ? Hotel : BedDouble;

  const selector = `[data-stay-site="${siteId}"]`;
  const lightTokens = buildTokens(theme.light || {}, DEFAULT_THEME.light);
  const darkTokens = buildTokens(theme.dark || {}, DEFAULT_THEME.dark);
  const themeCss = `${cssBlock(selector, lightTokens)}@media (prefers-color-scheme: dark){${cssBlock(selector, darkTokens)}}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE_BY_PREMISE[org.premise_type] || 'LodgingBusiness',
    name: org.name,
    ...(org.logo_url ? { image: org.logo_url, logo: org.logo_url } : {}),
    ...(site.address ? { address: { '@type': 'PostalAddress', streetAddress: site.address } } : {}),
    ...(site.lat != null && site.lng != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: Number(site.lat), longitude: Number(site.lng) } }
      : {}),
    ...(site.google_business_profile_url ? { sameAs: [site.google_business_profile_url] } : {}),
    url: `${SITE_URL}/stay/${siteId}`
  };

  return (
    <div className="guest-shell stay-shell" data-stay-site={siteId}>
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="guest-card stay-card glass-card">
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
            <p className="guest-space-label">Book your stay{site.name ? ` — ${site.name}` : ''}{site.address ? ` · ${site.address}` : ''}</p>
          </div>
        </div>

        <StayBookingForm siteId={siteId} orgName={org.name} />
      </div>
    </div>
  );
}

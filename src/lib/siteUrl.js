// Canonical origin for this app's public-facing URLs (plan Phase 10B —
// sitemap.js, robots.js, and the guest ordering page's JSON-LD/canonical
// link all need one absolute base). There's no per-tenant custom-domain
// routing yet (no middleware.js in this repo — confirmed by grep), so every
// org's guest ordering page is served from this one shared origin; set
// NEXT_PUBLIC_SITE_URL once this app has a real deployed domain. Falls back
// to the local dev server's own port so sitemap/robots still produce valid
// (if locally-scoped) absolute URLs with zero config.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');

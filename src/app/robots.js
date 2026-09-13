import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { SITE_URL } from '@/lib/siteUrl.js';

// plan/multi-tenant-platform-master-plan.md Phase 10B — Next.js App
// Router's robots.js convention (maps to GET /robots.txt).
//
// Per-tenant robots rules would ordinarily need per-domain routing (serve a
// different robots.txt per custom_domain) — this app has no such
// middleware.js/domain routing yet (confirmed by grep), so every org shares
// this one robots.txt. That still lets AI crawlers be gated *precisely*
// per org, though: each guest ordering URL is /order/<spaceId>, a stable
// per-space path, so an org with allow_ai_crawlers = false gets every one
// of its spaces' paths individually disallowed for just the named AI
// crawler user agents below — standard search engines are unaffected.
const AI_CRAWLER_AGENTS = ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended'];

export default async function robots() {
  const rules = [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin/'] }];

  try {
    const { data: optedOutOrgs, error: orgError } = await supabase.from('organizations').select('id').eq('allow_ai_crawlers', false);
    if (orgError) throw orgError;

    if (optedOutOrgs?.length) {
      const orgIds = optedOutOrgs.map((o) => o.id);
      const { data: sites, error: sitesError } = await supabase.from('sites').select('id').in('org_id', orgIds);
      if (sitesError) throw sitesError;

      const siteIds = (sites || []).map((s) => s.id);
      if (siteIds.length) {
        const { data: spaces, error: spacesError } = await supabase.from('spaces').select('id').in('site_id', siteIds);
        if (spacesError) throw spacesError;

        const disallowPaths = (spaces || []).map((s) => `/order/${s.id}`);
        if (disallowPaths.length) {
          for (const userAgent of AI_CRAWLER_AGENTS) {
            rules.push({ userAgent, allow: '/', disallow: disallowPaths });
          }
        }
      }
    }
  } catch (error) {
    // Falls back to the default rule only (every AI crawler treated the
    // same as a regular one) rather than 500ing robots.txt entirely — an
    // over-permissive robots.txt is a much smaller problem than crawlers
    // getting a broken one.
    logger.error('Failed to build per-org AI-crawler robots rules', { error: error.message });
  }

  return { rules, sitemap: `${SITE_URL}/sitemap.xml` };
}

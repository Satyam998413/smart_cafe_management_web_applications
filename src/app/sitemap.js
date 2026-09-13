import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { SITE_URL } from '@/lib/siteUrl.js';

// plan/multi-tenant-platform-master-plan.md Phase 10B — Next.js App Router's
// sitemap.js convention (this file maps to GET /sitemap.xml). Regenerated at
// most once an hour rather than on every crawl hit.
export const revalidate = 3600;

// One URL per SITE, not per space/table: every table at one site renders
// the same guest ordering page shape (same menu, same org branding) with
// only the table label differing, so listing every table individually
// would be thin/duplicate content for a search engine to index — the
// "or per site if per-space is too granular" option this task explicitly
// allowed. The representative space is that site's lowest-sort_order
// bookable space (typically its first table), standing in for "this
// site's guest ordering entry point."
//
// KNOWN LIMITATION: there's no per-org "exclude from sitemap" flag today
// (only allow_ai_crawlers, which is deliberately AI-crawler-specific — see
// robots.js) — every org with at least one bookable space is listed. Adding
// a real opt-out would need a new organizations column; out of scope here.
export default async function sitemap() {
  const staticEntries = [{ url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 0.5 }];

  try {
    // Deliberately not selecting created_at — serializeSpace (src/lib/
    // serializers.js) never exposes one for this table, so its existence
    // isn't confirmed; lastModified is optional in the sitemap entry shape.
    const { data, error } = await supabase
      .from('spaces')
      .select('id, site_id')
      .eq('is_bookable', true)
      .order('site_id', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) throw error;

    const seenSites = new Set();
    const spaceEntries = [];
    for (const space of data || []) {
      if (seenSites.has(space.site_id)) continue;
      seenSites.add(space.site_id);
      spaceEntries.push({
        url: `${SITE_URL}/order/${space.id}`,
        changeFrequency: 'weekly',
        priority: 0.8
      });
    }

    return [...staticEntries, ...spaceEntries];
  } catch (error) {
    logger.error('Failed to build sitemap', { error: error.message });
    return staticEntries;
  }
}

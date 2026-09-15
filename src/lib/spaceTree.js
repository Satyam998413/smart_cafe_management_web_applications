// Small, framework-free tree helpers shared by the Layout Builder (visual
// tree editor, plan Phase 2a) and the Staff page's site/space assignment
// picker — both consume the same flat, sort_order-ordered list
// GET /api/spaces?siteId= returns (see src/lib/spaceHelpers.js) and need the
// same parent_space_id -> children reconstruction to render it as a tree.

// Mirrors src/lib/spaceHelpers.js's SPACE_KINDS — floors/halls/galleries sit
// at the top level; tables/rooms/canteens nest under one of those (vision
// doc §3d: "one generic builder, not three separate ones per vertical").
// Gallery joins floor/hall rather than table/room/canteen — it's a whole
// area in its own right (an "art gallery hall"), not something that nests
// under a floor the way a table or room does.
export const TOP_LEVEL_KINDS = ['floor', 'hall', 'gallery'];
export const CHILD_KINDS = ['table', 'room', 'canteen'];

export const SPACE_KIND_LABELS = {
  floor: 'Floor',
  hall: 'Hall',
  table: 'Table',
  room: 'Room',
  canteen: 'Canteen',
  gallery: 'Gallery'
};

/** "Table 12" — falls back to just the label when there's no number. */
export function spaceLabel(space) {
  if (!space) return '';
  return space.number ? `${space.label} #${space.number}` : space.label;
}

/**
 * Builds a nested tree from spaceHelpers' flat list. GET /api/spaces
 * returns it pre-sorted by sort_order, but a client-side reorder (swapping
 * two siblings' sortOrder via PATCH, see the Layout Builder's `move`) only
 * patches the field — the array itself keeps its old order until the next
 * full refetch — so this re-sorts by sortOrder itself rather than trusting
 * incoming order, which is what makes a reorder show up immediately.
 */
export function buildSpaceTree(spaces) {
  const sorted = [...spaces].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const byId = new Map(sorted.map((s) => [s.id, { ...s, children: [] }]));
  const roots = [];
  for (const space of sorted) {
    const node = byId.get(space.id);
    if (space.parentSpaceId && byId.has(space.parentSpaceId)) {
      byId.get(space.parentSpaceId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Depth-first flattening of buildSpaceTree's output into `{ ...space, depth }`
 * rows — what both the tree editor (indentation) and the assignment
 * `<select>` (indented option labels) actually render.
 */
export function flattenSpaceTree(nodes, depth = 0) {
  const out = [];
  for (const node of nodes) {
    const { children, ...rest } = node;
    out.push({ ...rest, depth });
    out.push(...flattenSpaceTree(children || [], depth + 1));
  }
  return out;
}

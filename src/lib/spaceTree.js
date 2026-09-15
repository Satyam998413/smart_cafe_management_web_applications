// Small, framework-free tree helpers shared by the Layout Builder (visual
// tree editor) and the Staff page's site/space assignment picker.

export const TOP_LEVEL_KINDS = ['floor', 'hall', 'gallery', 'building'];
export const CHILD_KINDS = ['canteen', 'room', 'corridor', 'hall', 'table', 'pickup_station'];

export const SPACE_KIND_LABELS = {
  floor: 'Floor',
  hall: 'Hall',
  canteen: 'Canteen / Cafe',
  room: 'Room',
  corridor: 'Corridor',
  table: 'Table',
  pickup_station: 'Pickup Station',
  gallery: 'Gallery',
  building: 'Building'
};

/** "Table 12" — falls back to just the label when there's no number. */
export function spaceLabel(space) {
  if (!space) return '';
  return space.number ? `${space.label} #${space.number}` : space.label;
}

/**
 * Builds a nested tree from spaceHelpers' flat list.
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

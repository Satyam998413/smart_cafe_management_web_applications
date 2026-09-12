'use client';

// Ported unchanged from react_app/src/components/ui/Skeleton.jsx.
export function Skeleton({ width = '100%', height = '1rem', radius = 'var(--radius-sm)', style }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Card-shaped placeholder mimicking OrderCard / MenuCard proportions while data loads. */
export function SkeletonCard() {
  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width="35%" height="1.1rem" />
        <Skeleton width="22%" height="1.4rem" radius="var(--radius-full)" />
      </div>
      <Skeleton width="70%" height="0.85rem" />
      <Skeleton width="50%" height="0.85rem" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
        <Skeleton width="25%" height="1.2rem" />
        <Skeleton width="30%" height="2rem" radius="var(--radius-md)" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6, gridClassName = 'order-grid' }) {
  return (
    <div className={gridClassName}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

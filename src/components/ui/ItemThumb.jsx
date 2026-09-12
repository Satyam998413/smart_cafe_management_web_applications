'use client';

import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

// Ported unchanged from react_app/src/components/ui/ItemThumb.jsx.
/** Small item thumbnail with a graceful icon fallback for missing/broken images. */
export default function ItemThumb({ src, alt, size = 36 }) {
  const [error, setError] = useState(false);

  return (
    <div className="item-thumb" style={{ width: size, height: size }}>
      {src && !error ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt || ''} onError={() => setError(true)} />
      ) : (
        <UtensilsCrossed size={Math.round(size * 0.45)} strokeWidth={1.5} />
      )}
    </div>
  );
}

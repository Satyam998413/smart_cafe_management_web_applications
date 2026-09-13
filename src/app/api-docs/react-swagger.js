'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// swagger-ui-react reaches for `window` on import, so it can only ever run
// client-side (Next's own lazy-loading docs: "ssr: false is not allowed with
// next/dynamic in Server Components — move it into a Client Component",
// hence this file existing separately from the page.js server component
// that fetches the spec).
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ReactSwagger({ spec }) {
  return <SwaggerUI spec={spec} />;
}

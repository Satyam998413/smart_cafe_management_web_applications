import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Route Handlers are plain functions over the Web Request/Response API, so
// unit tests need no DOM — 'node' matches how server/'s Jest suite tests
// controllers. Add a jsdom project separately if/when React components
// (features/**) get their own tests.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.js']
  }
});

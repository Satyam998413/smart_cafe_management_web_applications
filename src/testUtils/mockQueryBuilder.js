import { vi } from 'vitest';

// A minimal stand-in for the Supabase/PostgREST fluent query builder.
// Every chain method returns the same builder, and the builder itself is
// awaitable (via `.then`) so `await query` resolves to `result` whether or
// not a terminal method like `.single()`/`.maybeSingle()` was called.
// Ported from server/src/testUtils/mockQueryBuilder.js (jest.fn -> vi.fn).
const CHAIN_METHODS = [
  'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'order', 'range', 'limit',
  'update', 'insert', 'upsert', 'delete', 'is', 'in', 'not', 'or'
];

export function createMockQueryBuilder(result) {
  const builder = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (onResolve, onReject) => Promise.resolve(result).then(onResolve, onReject);
  return builder;
}

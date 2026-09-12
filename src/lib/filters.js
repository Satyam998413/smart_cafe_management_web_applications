// Ported unchanged from server/src/utils/filters.js. PostgREST's or() filter
// syntax treats commas/parens as delimiters; wrapping the value in double
// quotes (with internal backslashes/quotes escaped) makes it a single
// literal instead of letting a crafted identifier inject extra filter clauses.
export const escapeFilterValue = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

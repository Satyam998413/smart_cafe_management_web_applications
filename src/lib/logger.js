/**
 * Ported unchanged from server/src/utils/logger.js. Simple structured
 * logger using console with ISO timestamps. Drop-in compatible with
 * winston-style API (info, warn, error, debug).
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const base = JSON.stringify({ timestamp, level, message, ...meta });
  return base;
}

function log(level, message, meta = {}) {
  if (LEVELS[level] < LOG_LEVEL) return;
  const output = formatMessage(level, message, meta);
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

const logger = {
  debug: (message, meta) => log('debug', message, meta),
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta)
};

export default logger;

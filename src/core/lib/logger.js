const isDev = import.meta.env.MODE !== 'production';

import { safePayload } from './safeLog.js';

function sanitizeArgs(args) {
  // Para cada argumento, se for objeto (não primitivo, não Error nativo, não
  // string) aplica safePayload. O resultado é uma TUPLA de args prontos para
  // o console.* — strings ficam string, objetos viram cópia sanitizada,
  // Errors viram { message, code?, name? }.
  return args.map((arg) => {
    if (arg === null || arg === undefined) return arg;
    if (typeof arg !== 'object') return arg;
    if (arg instanceof Error) return arg; // Error → console.error mostra stack
    if (Array.isArray(arg)) return safePayload(arg);
    return safePayload(arg);
  });
}

export const logger = {
  info: (...args) => {
    if (isDev) console.info('[INFO]', ...sanitizeArgs(args));
  },
  warn: (...args) => {
    console.warn('[WARN]', ...sanitizeArgs(args));
  },
  error: (...args) => {
    console.error('[ERROR]', ...sanitizeArgs(args));
  },
  debug: (...args) => {
    if (isDev) console.debug('[DEBUG]', ...sanitizeArgs(args));
  },
};

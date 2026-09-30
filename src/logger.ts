/** Pluggable logger — silent by default, console when debug is on. */
import type { Logger } from './types';

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function consoleLogger(prefix = '[sautocomplete]'): Logger {
  return {
    debug: (...a) => console.debug(prefix, ...a),
    info: (...a) => console.info(prefix, ...a),
    warn: (...a) => console.warn(prefix, ...a),
    error: (...a) => console.error(prefix, ...a),
  };
}

export function resolveLogger(debug: boolean, custom?: Logger): Logger {
  if (custom) return custom;
  return debug ? consoleLogger() : noopLogger;
}

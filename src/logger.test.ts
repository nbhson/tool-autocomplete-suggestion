import { describe, it, expect, vi, afterEach } from 'vitest';
import { noopLogger, consoleLogger, resolveLogger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('noopLogger', () => {
  it('accepts any call without throwing or printing', () => {
    const spy = vi.spyOn(console, 'debug');
    vi.spyOn(console, 'warn');
    expect(() => {
      noopLogger.debug('x');
      noopLogger.info('x');
      noopLogger.warn('x');
      noopLogger.error('x');
    }).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('consoleLogger', () => {
  it('routes each level to the matching console method with a prefix', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = consoleLogger('[test]');
    log.debug('d', 1);
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(debug).toHaveBeenCalledWith('[test]', 'd', 1);
    expect(info).toHaveBeenCalledWith('[test]', 'i');
    expect(warn).toHaveBeenCalledWith('[test]', 'w');
    expect(error).toHaveBeenCalledWith('[test]', 'e');
  });
});

describe('resolveLogger', () => {
  it('returns the custom logger when provided', () => {
    const custom = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };
    expect(resolveLogger(true, custom)).toBe(custom);
  });

  it('returns consoleLogger when debug is on', () => {
    const log = resolveLogger(true);
    expect(log.debug).toBeTypeOf('function');
    // consoleLogger delegates to console methods
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    log.debug('hi');
    expect(spy).toHaveBeenCalled();
  });

  it('returns noopLogger by default', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    resolveLogger(false).debug('hi');
    expect(spy).not.toHaveBeenCalled();
  });
});

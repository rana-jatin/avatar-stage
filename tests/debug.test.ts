import { describe, it, expect, vi, afterEach } from 'vitest';
import { setDebug, isDebug, dlog } from '../src/debug';

afterEach(() => {
  setDebug(false);
  vi.restoreAllMocks();
});

describe('debug logging', () => {
  it('is off by default and stays silent', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isDebug()).toBe(false);
    dlog('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs with a prefix once enabled', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setDebug(true);
    expect(isDebug()).toBe(true);
    dlog('hello', { n: 1 });
    expect(spy).toHaveBeenCalledWith('[avatar-stage]', 'hello', { n: 1 });
  });
});

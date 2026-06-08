import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const listenMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

import { safeListen } from './tauriEvents';

describe('safeListen', () => {
  beforeEach(() => {
    listenMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unlistens exactly once when cleanup runs before listener setup resolves', async () => {
    const unlisten = vi.fn();
    let resolveListen: (unlisten: () => void) => void = () => {};
    listenMock.mockReturnValue(new Promise((resolve) => {
      resolveListen = resolve;
    }));

    const cleanup = safeListen('tauri://focus', vi.fn());
    cleanup();
    resolveListen(unlisten);
    await Promise.resolve();

    cleanup();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('catches listener setup failures after cleanup', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    listenMock.mockRejectedValue(new Error('listener failed'));

    const cleanup = safeListen('tauri://focus', vi.fn());
    cleanup();
    await Promise.resolve();

    expect(consoleError).not.toHaveBeenCalled();
  });
});

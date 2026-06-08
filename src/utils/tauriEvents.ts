import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';

function safeUnlisten(unlisten: UnlistenFn, eventName: string) {
  try {
    const result = unlisten() as void | Promise<void>;
    if (result && typeof result.then === 'function') {
      result.catch((err) => {
        console.error(`Failed to remove Tauri listener "${eventName}":`, err);
      });
    }
  } catch (err) {
    console.error(`Failed to remove Tauri listener "${eventName}":`, err);
  }
}

export function safeListen<T>(eventName: string, handler: (event: Event<T>) => void | Promise<void>) {
  let disposed = false;
  let unlisten: UnlistenFn | undefined;

  listen<T>(eventName, handler)
    .then((nextUnlisten) => {
      if (disposed) {
        safeUnlisten(nextUnlisten, eventName);
        return;
      }

      unlisten = nextUnlisten;
    })
    .catch((err) => {
      if (!disposed) {
        console.error(`Failed to add Tauri listener "${eventName}":`, err);
      }
    });

  return () => {
    if (disposed) return;
    disposed = true;

    if (!unlisten) return;
    safeUnlisten(unlisten, eventName);
    unlisten = undefined;
  };
}

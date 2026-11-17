let pending: Promise<unknown> | null = null;

export function trackInitialLanguageSave<T>(save: Promise<T>): Promise<T> {
  const tracked: Promise<unknown> = save.then(
    () => undefined,
    () => undefined
  );
  pending = tracked;
  void tracked.then(() => {
    if (pending === tracked) pending = null;
  });
  return save;
}

export function initialLanguageSaveSettled(): Promise<void> {
  return (pending ?? Promise.resolve()).then(
    () => undefined,
    () => undefined
  );
}

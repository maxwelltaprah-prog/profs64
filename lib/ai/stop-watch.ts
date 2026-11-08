// Calls onStop once when check() reports true, polling every intervalMs without overlapping
// checks. A failing check is ignored. Returns a function that ends the watching.
export function watchForStop(
  check: () => Promise<boolean>,
  onStop: () => void,
  intervalMs = 1500,
): () => void {
  let busy = false;
  let finished = false;
  const timer = setInterval(() => {
    if (busy || finished) return;
    busy = true;
    void check()
      .then((stop) => {
        if (stop && !finished) {
          finished = true;
          clearInterval(timer);
          onStop();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        busy = false;
      });
  }, intervalMs);
  return () => {
    finished = true;
    clearInterval(timer);
  };
}

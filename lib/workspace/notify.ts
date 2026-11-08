// Browser notifications for "the assistant is done", only while the tab is in the background and
// only after the person has said yes. The text never includes their prompt or the reply.

const ASKED_KEY = "buildr:notify-asked";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function asked(): boolean {
  try {
    return window.localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true; // No storage: do not keep asking.
  }
}

export function markAsked(): void {
  try {
    window.localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // Ignore; the prompt may show again, which is harmless.
  }
}

// Whether to offer the in-app "get notified" prompt: supported, never decided in the browser and
// never answered in the app.
export function shouldOfferNotifications(): boolean {
  return notificationsSupported() && Notification.permission === "default" && !asked();
}

export async function requestNotifications(): Promise<boolean> {
  markAsked();
  if (!notificationsSupported()) return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export function notifyDone(kind: "done" | "error"): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  if (document.visibilityState !== "hidden") return;
  try {
    const note = new Notification(kind === "done" ? "Buildr is done" : "Buildr stopped", {
      body:
        kind === "done"
          ? "The assistant finished working on your project."
          : "The assistant ran into a problem. Open the project to see what happened.",
      tag: "buildr-done",
    });
    note.onclick = () => {
      window.focus();
      note.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker; skip quietly.
  }
}

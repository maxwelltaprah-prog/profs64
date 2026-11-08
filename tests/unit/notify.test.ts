// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { notifyDone, requestNotifications, shouldOfferNotifications } from "@/lib/workspace/notify";

const created: Array<{ title: string; options: NotificationOptions }> = [];

function installNotification(
  permission: NotificationPermission,
  answer: NotificationPermission = "granted",
) {
  class FakeNotification {
    static permission = permission;
    static requestPermission = vi.fn(async () => answer);
    onclick: (() => void) | null = null;
    constructor(title: string, options: NotificationOptions) {
      created.push({ title, options });
    }
    close() {}
  }
  vi.stubGlobal("Notification", FakeNotification);
  return FakeNotification;
}

const setHidden = (hidden: boolean) =>
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });

beforeEach(() => {
  created.length = 0;
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setHidden(false);
});

describe("offering notifications", () => {
  it("offers once, only when the browser has not decided yet", async () => {
    installNotification("default");
    expect(shouldOfferNotifications()).toBe(true);
    expect(await requestNotifications()).toBe(true);
    expect(shouldOfferNotifications()).toBe(false);
  });

  it("does not offer when already granted or denied, or when unsupported", () => {
    installNotification("granted");
    expect(shouldOfferNotifications()).toBe(false);
    installNotification("denied");
    expect(shouldOfferNotifications()).toBe(false);
    vi.unstubAllGlobals();
    expect(shouldOfferNotifications()).toBe(false);
  });
});

describe("notifyDone", () => {
  it("notifies only in the background and only with permission, without any message text", () => {
    installNotification("granted");
    setHidden(false);
    notifyDone("done");
    expect(created).toHaveLength(0);

    setHidden(true);
    notifyDone("done");
    expect(created).toHaveLength(1);
    expect(created[0]?.title).toBe("Buildr is done");
    expect(created[0]?.options.body).toBe("The assistant finished working on your project.");

    installNotification("default");
    notifyDone("error");
    expect(created).toHaveLength(1);
  });
});

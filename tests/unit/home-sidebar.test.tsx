// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeSidebar } from "@/components/home/home-sidebar";
import { AppearanceSetting } from "@/components/settings/appearance-setting";

vi.mock("@/components/use-app-actions", () => ({
  useAppActions: () => ({ actions: [], signOut: vi.fn(), signingOut: false }),
}));
vi.mock("@/components/command-palette", () => ({
  CommandPalette: () => <button type="button">Search</button>,
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
  applyTheme: (choice: "light" | "dark" | "system") => {
    if (choice === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", choice);
    document.cookie = `buildr-theme=${choice}; path=/; max-age=31536000; samesite=lax`;
  },
}));
vi.mock("@/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  document.cookie = "buildr-theme=; path=/; max-age=0";
});

describe("signed-in navigation", () => {
  it("offers Settings and puts Upgrade above the account email", () => {
    render(
      <HomeSidebar
        balance={9.36}
        theme="dark"
        email="person@example.com"
        recent={[]}
        active="settings"
      />,
    );

    expect(
      screen
        .getAllByRole("link", { name: "Settings" })
        .every((link) => link.getAttribute("href") === "/settings"),
    ).toBe(true);
    const upgrade = screen.getAllByRole("link", { name: "Upgrade" });
    expect(upgrade).toHaveLength(2);
    expect(upgrade[0]?.getAttribute("aria-label")).toBe("Upgrade");
    const desktopUpgrade = upgrade.find((link) => link.textContent?.trim() === "Upgrade");
    expect(desktopUpgrade?.getAttribute("href")).toBe("/upgrade");
    if (desktopUpgrade) {
      expect(screen.getByText("person@example.com").compareDocumentPosition(desktopUpgrade)).toBe(
        Node.DOCUMENT_POSITION_PRECEDING,
      );
    }
  });
});

describe("appearance settings", () => {
  it("updates the selected theme and persists it", async () => {
    render(<AppearanceSetting initial="system" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: /Light.*A bright workspace/ }));

    expect(
      screen.getByRole("radio", { name: /Light.*A bright workspace/ }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.cookie).toContain("buildr-theme=light");
  });
});

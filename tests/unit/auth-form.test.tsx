// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";

const fields = [
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
    minLength: 12,
  },
] as const;

function renderForm() {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<AuthForm endpoint="/api/auth/signup" submitLabel="Create account" fields={fields} />);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthForm client-side checks", () => {
  it("names the field and the minimum length for a short password, without calling the server", async () => {
    const fetchMock = renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "person@example.org");
    await user.type(screen.getByLabelText("Password"), "tooshort10");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert").textContent).toBe("Password must be at least 12 characters.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for an empty field by name", async () => {
    const fetchMock = renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Password"), "a-long-enough-passphrase");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert").textContent).toBe("Enter your email.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits when the checks pass", async () => {
    const fetchMock = renderForm();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "person@example.org");
    await user.type(screen.getByLabelText("Password"), "a-long-enough-passphrase");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("AuthForm sign-in details", () => {
  it("moves focus to the field that needs fixing", async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "person@example.org");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
  });

  it("shows and hides the password with a labelled toggle, and keeps paste allowed", async () => {
    renderForm();
    const user = userEvent.setup();
    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.getAttribute("type")).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.getAttribute("type")).toBe("password");
    expect(password.getAttribute("onpaste")).toBeNull();
  });

  it("marks email as the last used method only after a successful sign-in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    window.localStorage.clear();
    render(
      <AuthForm
        endpoint="/api/auth/login"
        submitLabel="Sign in"
        redirectTo="/dashboard"
        rememberMethod
        fields={fields}
      />,
    );
    expect(screen.queryByText("Last used")).toBeNull();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "person@example.org");
    await user.type(screen.getByLabelText("Password"), "a-long-enough-passphrase");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(window.localStorage.getItem("buildr:last-auth")).toBe("email");
    cleanup();
    render(
      <AuthForm endpoint="/api/auth/login" submitLabel="Sign in" rememberMethod fields={fields} />,
    );
    expect(await screen.findByText("Last used")).toBeTruthy();
  });
});

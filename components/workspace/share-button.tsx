"use client";

import { Check, Copy, Link2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";

// Share a project as a read-only public preview. The server owns the slug; this just turns sharing
// on or off and shows the link. The link works for anyone, so it is an unlisted share.
export function ShareButton({
  projectId,
  initialSlug,
  available,
}: {
  projectId: string;
  initialSlug: string | null;
  available: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // The origin is only known in the browser; read it once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const url = slug ? `${origin}/p/${slug}` : "";

  const open = () => dialog.current?.showModal();
  const close = () => dialog.current?.close();

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/share`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        slug?: string;
        error?: { message?: string };
      } | null;
      if (response.ok && body?.slug) setSlug(body.slug);
      else setError(body?.error?.message ?? "Could not create a link. Try again.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/share`, { method: "DELETE" });
      if (response.ok) setSlug(null);
      else setError("Could not stop sharing. Try again.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the field is selectable.
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={open} className="gap-1.5">
        <Link2 {...iconProps} />
        Share
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="share-title"
        className="bg-surface border-hairline-strong text-text m-auto w-[min(480px,calc(100vw-2rem))] rounded-xl border p-0 shadow-md backdrop:bg-black/30"
      >
        <div className="flex items-start justify-between gap-4 p-5">
          <div>
            <h2 id="share-title" className="text-base font-semibold tracking-tight">
              Share a preview
            </h2>
            <p className="text-muted mt-1 text-[13px] leading-5">
              Anyone with the link can open a read-only preview of this project&apos;s app. They
              cannot see your chat, files or account.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={close}>
            <X {...iconProps} />
          </Button>
        </div>
        <div className="border-hairline border-t px-5 py-4">
          {!available ? (
            <p className="text-muted text-[13px]">
              Sharing becomes available once the latest database update is applied.
            </p>
          ) : slug ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="share-url">
                  Public link
                </label>
                <input
                  id="share-url"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="border-input bg-surface min-w-0 flex-1 rounded-md border px-3 py-1.5 font-mono text-[13px]"
                />
                <Button variant="secondary" size="sm" onClick={() => void copy()}>
                  {copied ? <Check {...iconProps} /> : <Copy {...iconProps} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent text-[13px] underline underline-offset-4"
                >
                  Open the preview
                </a>
                <Button variant="ghost" size="sm" loading={busy} onClick={() => void disable()}>
                  Stop sharing
                </Button>
              </div>
            </div>
          ) : (
            <Button loading={busy} onClick={() => void enable()}>
              <Link2 {...iconProps} />
              Create a public link
            </Button>
          )}
          {error ? (
            <p role="alert" className="text-danger mt-3 text-[13px]">
              {error}
            </p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

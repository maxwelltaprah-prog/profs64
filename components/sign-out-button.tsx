"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";

export function SignOutButton({
  signingOut,
  onSignOut,
}: {
  signingOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={signingOut ? "Signing out" : "Sign out"}
      title="Sign out"
      loading={signingOut}
      onClick={onSignOut}
    >
      {signingOut ? <span aria-hidden="true" className="spinner" /> : <LogOut {...iconProps} />}
    </Button>
  );
}

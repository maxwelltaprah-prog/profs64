"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";

export function SignOutButton({
  signingOut,
  onSignOut,
  className,
}: {
  signingOut: boolean;
  onSignOut: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={signingOut ? "Signing out" : "Sign out"}
      title="Sign out"
      loading={signingOut}
      onClick={onSignOut}
    >
      {signingOut ? <span aria-hidden="true" className="spinner" /> : <LogOut {...iconProps} />}
    </Button>
  );
}

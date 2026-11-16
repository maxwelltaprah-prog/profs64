"use client";

import { Settings } from "lucide-react";
import { useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { type RunnableAction } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { type ThemeChoice } from "@/lib/theme";

import { ProjectSettings, type SettingsSection } from "./project-settings";
import { ShareButton } from "./share-button";

// The project screen's top bar. On a phone it is a single compact row (logo, project name,
// credits, search, settings); Share, theme and sign out move into settings and the command palette
// so nothing competes for space with the name.
export function ProjectHeader({
  balance,
  theme,
  projectId,
  name,
  createdAt,
  ownerEmail,
  built,
  shareSlug,
  shareAvailable,
}: {
  balance: number;
  theme: ThemeChoice;
  projectId: string;
  name: string;
  createdAt: string | null;
  ownerEmail: string;
  built: boolean;
  shareSlug: string | null;
  shareAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("details");

  const openAt = (next: SettingsSection) => {
    setSection(next);
    setOpen(true);
  };

  const extraActions = useMemo<RunnableAction[]>(
    () => [
      {
        id: "project-settings",
        label: "Project settings",
        keywords: "rename details name delete",
        run: () => {
          setSection("details");
          setOpen(true);
        },
      },
      {
        id: "project-share",
        label: "Share this project",
        keywords: "public link preview",
        run: () => {
          setSection("sharing");
          setOpen(true);
        },
      },
      {
        id: "project-github",
        label: "Push to GitHub",
        keywords: "git export repository deploy",
        run: () => {
          setSection("github");
          setOpen(true);
        },
      },
    ],
    [],
  );

  return (
    <>
      <AppHeader
        balance={balance}
        theme={theme}
        extraActions={extraActions}
        trailing={
          <>
            <ShareButton
              projectId={projectId}
              initialSlug={shareSlug}
              available={shareAvailable}
              className="max-sm:hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              className="touch-target"
              aria-label="Project settings"
              title="Project settings"
              onClick={() => openAt("details")}
            >
              <Settings {...iconProps} />
            </Button>
          </>
        }
      >
        <span className="text-text min-w-0 truncate text-[13px] font-medium" title={name}>
          {name}
        </span>
      </AppHeader>
      <ProjectSettings
        open={open}
        section={section}
        onSectionChange={setSection}
        onClose={() => setOpen(false)}
        projectId={projectId}
        name={name}
        createdAt={createdAt}
        ownerEmail={ownerEmail}
        built={built}
        shareSlug={shareSlug}
        shareAvailable={shareAvailable}
      />
    </>
  );
}

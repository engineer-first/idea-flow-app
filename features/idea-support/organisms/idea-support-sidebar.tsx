"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { IdeaSupportSidebarContent } from "../molecules/idea-support-sidebar-content";
import { IdeaSupportSidebarHeader } from "../molecules/idea-support-sidebar-header";

export function IdeaSupportSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card
      className={cn(
        "pointer-events-auto flex h-full flex-col overflow-hidden",
        isOpen ? "w-80" : "size-10",
      )}
    >
      <IdeaSupportSidebarHeader
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
      />

      {isOpen && <IdeaSupportSidebarContent />}
    </Card>
  );
}

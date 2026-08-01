import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

interface KindBadgeProps {
  kind: string;
  className?: string;
}

export function KindBadge({ kind, className }: KindBadgeProps) {
  const { t } = useTranslation();
  const kindCode = kind ? kind.trim() : "s";
  const rawLabel = t(`kinds.${kindCode}`, { defaultValue: kindCode });
  const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase() : "";

  let color: "blue" | "purple" | "emerald" | "amber" | "rose" | "indigo" | "zinc" = "zinc";

  switch (kindCode) {
    case "s":
    case "n":
    case "k":
      color = "blue";
      break;
    case "c":
      color = "purple";
      break;
    case "i":
      color = "emerald";
      break;
    case "a":
      color = "amber";
      break;
    case "p":
      color = "rose";
      break;
    case "P":
    case "L":
      color = "indigo";
      break;
  }

  return (
    <Tag color={color} className={className}>
      {label}
    </Tag>
  );
}

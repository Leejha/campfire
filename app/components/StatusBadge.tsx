import type { ComponentProps, ReactElement } from "react";

import { Badge as ShadcnBadge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type StatusBadgeTone = "primary" | "accent" | "success" | "neutral";

interface StatusBadgeProps extends Omit<ComponentProps<typeof ShadcnBadge>, "variant"> {
  tone: StatusBadgeTone;
}

const STATUS_BADGE_TONE_CLASS_NAMES: Record<StatusBadgeTone, string> = {
  primary: "bg-primary text-primary-foreground",
  accent: "bg-live text-live-foreground",
  success: "bg-success text-success-foreground",
  neutral: "bg-muted text-foreground",
};

export function StatusBadge({
  className,
  tone,
  ...props
}: Readonly<StatusBadgeProps>): ReactElement {
  return (
    <ShadcnBadge
      variant="outline"
      className={cn(
        "border-transparent px-2.5 py-1 text-xs font-semibold tracking-wide",
        STATUS_BADGE_TONE_CLASS_NAMES[tone],
        className,
      )}
      {...props}
    />
  );
}

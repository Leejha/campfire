import type { ComponentProps, ReactElement } from "react";

import { Badge as ShadcnBadge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type StatusBadgeTone = "primary" | "accent" | "success" | "neutral";

interface StatusBadgeProps extends Omit<ComponentProps<typeof ShadcnBadge>, "variant"> {
  tone: StatusBadgeTone;
}

const STATUS_BADGE_TONE_CLASS_NAMES: Record<StatusBadgeTone, string> = {
  primary: "bg-bg-brand-weak text-fg-brand-contrast",
  accent: "bg-bg-brand-weak text-fg-brand-contrast",
  success: "bg-bg-positive-weak text-fg-positive-contrast",
  neutral: "bg-bg-neutral-weak text-fg-neutral-muted",
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
        "border-transparent px-x2_5 py-x1 t2-bold tracking-wide",
        STATUS_BADGE_TONE_CLASS_NAMES[tone],
        className,
      )}
      {...props}
    />
  );
}

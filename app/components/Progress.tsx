import type { ComponentProps, ReactElement } from "react";

import { Progress as ShadcnProgress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

const MIN_PROGRESS_VALUE = 0;
const MAX_PROGRESS_VALUE = 100;

interface ProgressProps
  extends Omit<
    ComponentProps<typeof ShadcnProgress>,
    "aria-label" | "aria-valuetext" | "value"
  > {
  label: string;
  value: number;
  valueText: string;
}

export function Progress({
  className,
  label,
  value,
  valueText,
  ...props
}: Readonly<ProgressProps>): ReactElement {
  const clampedValue = Math.min(
    Math.max(value, MIN_PROGRESS_VALUE),
    MAX_PROGRESS_VALUE,
  );

  return (
    <ShadcnProgress
      aria-label={label}
      aria-valuetext={valueText}
      className={cn("h-x2_5 bg-bg-neutral-weak", className)}
      value={clampedValue}
      {...props}
    />
  );
}

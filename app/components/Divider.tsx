import type { ComponentProps, ReactElement } from "react";

import { Separator as ShadcnSeparator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

interface DividerProps extends Omit<ComponentProps<typeof ShadcnSeparator>, "decorative"> {}

export function Divider({
  className,
  ...props
}: Readonly<DividerProps>): ReactElement {
  return (
    <ShadcnSeparator
      decorative
      className={cn("bg-border/80", className)}
      {...props}
    />
  );
}

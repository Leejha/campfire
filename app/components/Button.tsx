import type { ComponentProps, ReactElement } from "react";

import { Button as ShadcnButton } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ButtonProps extends ComponentProps<typeof ShadcnButton> {}

export function Button({ className, ...props }: Readonly<ButtonProps>): ReactElement {
  return (
    <ShadcnButton
      className={cn("focus-visible:ring-ring/50", className)}
      {...props}
    />
  );
}

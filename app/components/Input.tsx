import type { ComponentProps, ReactElement } from "react";

import { Input as ShadcnInput } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface InputProps extends ComponentProps<typeof ShadcnInput> {}

export function Input({ className, ...props }: Readonly<InputProps>): ReactElement {
  return (
    <ShadcnInput
      className={cn("bg-background", className)}
      {...props}
    />
  );
}

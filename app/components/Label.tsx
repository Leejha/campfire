import type { ComponentProps, ReactElement } from "react";

import { Label as ShadcnLabel } from "~/components/ui/label";
import { cn } from "~/lib/utils";

interface LabelProps extends ComponentProps<typeof ShadcnLabel> {}

export function Label({ className, ...props }: Readonly<LabelProps>): ReactElement {
  return <ShadcnLabel className={cn("text-foreground", className)} {...props} />;
}

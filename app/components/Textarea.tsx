import type { ComponentProps, ReactElement } from "react";

import { Textarea as ShadcnTextarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

interface TextareaProps extends ComponentProps<typeof ShadcnTextarea> {}

export function Textarea({ className, ...props }: Readonly<TextareaProps>): ReactElement {
  return (
    <ShadcnTextarea
      className={cn("bg-bg-layer-default", className)}
      {...props}
    />
  );
}

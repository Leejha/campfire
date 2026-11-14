import * as React from "react"

import { cn } from "~/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[var(--seed-dimension-x12)] w-full resize-y rounded-r2 border border-stroke-neutral-weak bg-transparent px-x3 py-x2 t5-regular shadow-s1 outline-none transition-colors placeholder:text-fg-placeholder focus-visible:border-stroke-focus-ring focus-visible:ring-[3px] focus-visible:ring-stroke-focus-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:t4-regular",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

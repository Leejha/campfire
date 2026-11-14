import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "~/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-x5 w-fit shrink-0 items-center justify-center gap-x1 overflow-hidden rounded-r6 border border-transparent px-x2 py-x0_5 t2-medium whitespace-nowrap transition-all focus-visible:border-stroke-focus-ring focus-visible:ring-[3px] focus-visible:ring-stroke-focus-ring/50 has-data-[icon=inline-end]:pr-x1_5 has-data-[icon=inline-start]:pl-x1_5 aria-invalid:border-stroke-critical-solid aria-invalid:ring-stroke-critical-solid/20 [&>svg]:pointer-events-none [&>svg]:size-x3!",
  {
    variants: {
      variant: {
        default: "bg-bg-brand-solid text-fg-neutral-inverted [a]:hover:bg-bg-brand-solid-pressed",
        secondary:
          "bg-bg-neutral-weak text-fg-neutral [a]:hover:bg-bg-layer-default-pressed",
        destructive:
          "bg-bg-critical-weak text-fg-critical focus-visible:ring-stroke-critical-solid/20 [a]:hover:bg-bg-critical-weak-pressed",
        outline:
          "border-stroke-neutral-weak text-fg-neutral [a]:hover:bg-bg-neutral-weak [a]:hover:text-fg-neutral-muted",
        ghost:
          "hover:bg-bg-neutral-weak hover:text-fg-neutral-muted",
        link: "text-fg-brand underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

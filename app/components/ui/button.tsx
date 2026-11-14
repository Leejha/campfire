import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-x2 rounded-r2 t4-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-stroke-focus-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-x4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-bg-brand-solid text-fg-neutral-inverted hover:bg-bg-brand-solid-pressed",
        outline: "border border-stroke-neutral-weak bg-bg-layer-default hover:bg-bg-layer-default-pressed hover:text-fg-neutral",
        ghost: "hover:bg-bg-neutral-weak hover:text-fg-neutral",
        destructive: "bg-bg-critical-solid text-fg-neutral-inverted hover:bg-bg-critical-solid-pressed",
      },
      size: {
        default: "min-h-11 min-w-11 h-11 px-x4 py-x2",
        sm: "min-h-11 min-w-11 h-11 rounded-r1_5 px-x3 t2-medium",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }

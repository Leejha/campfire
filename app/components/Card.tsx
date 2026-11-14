import type { ComponentProps, ReactElement } from "react";

import {
  Card as ShadcnCard,
  CardContent as ShadcnCardContent,
  CardHeader as ShadcnCardHeader,
  CardTitle as ShadcnCardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

interface CardProps extends ComponentProps<typeof ShadcnCard> {}

interface CardHeaderProps extends ComponentProps<typeof ShadcnCardHeader> {}

interface CardTitleProps extends ComponentProps<typeof ShadcnCardTitle> {}

interface CardContentProps extends ComponentProps<typeof ShadcnCardContent> {}

export function Card({
  className,
  ...props
}: Readonly<CardProps>): ReactElement {
  return (
    <ShadcnCard
      className={cn("border border-stroke-neutral-subtle bg-bg-layer-default shadow-s1", className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: Readonly<CardHeaderProps>): ReactElement {
  return <ShadcnCardHeader className={cn("gap-x3", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: Readonly<CardTitleProps>): ReactElement {
  return <ShadcnCardTitle className={cn("text-fg-neutral", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: Readonly<CardContentProps>): ReactElement {
  return <ShadcnCardContent className={cn("text-fg-neutral", className)} {...props} />;
}

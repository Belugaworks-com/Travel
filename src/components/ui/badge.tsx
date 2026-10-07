import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium [&>svg]:size-3",
  {
    variants: {
      variant: {
        outline: "text-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        good: "border-good/25 bg-good/10 text-good",
        warn: "border-warn/30 bg-warn/12 text-warn",
        bad: "border-bad/25 bg-bad/10 text-bad",
        signal: "border-transparent bg-signal text-signal-foreground",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };

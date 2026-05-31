import React from "react";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef(({ className, orientation = "horizontal", ...props }, ref) =>
  React.createElement(orientation === 'horizontal' ? 'hr' : 'div', {
    ref,
    className: cn("th-separator", orientation === 'vertical' ? 'vr' : '', className),
    ...props
  })
);
Separator.displayName = "Separator";

export { Separator };

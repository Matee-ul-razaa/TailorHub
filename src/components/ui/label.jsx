import React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef(({ className, children, ...props }, ref) =>
  React.createElement('label', {
    ref,
    className: cn("th-label", className),
    ...props
  }, children)
);
Label.displayName = "Label";

export { Label };

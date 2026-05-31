import React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) =>
  React.createElement('input', {
    ref,
    type,
    className: cn("th-input", className),
    ...props
  })
);
Input.displayName = "Input";

export { Input };

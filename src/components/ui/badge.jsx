import React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef(({ className, variant = "default", children, ...props }, ref) => {
  const variants = {
    default: "th-badge th-badge-accent",
    secondary: "th-badge th-badge-soft",
    outline: "th-badge th-badge-outline",
    destructive: "th-badge bg-danger text-white",
  };

  return React.createElement('span', {
    ref,
    className: cn(variants[variant] || variants.default, className),
    ...props
  }, children);
});
Badge.displayName = "Badge";

export { Badge };

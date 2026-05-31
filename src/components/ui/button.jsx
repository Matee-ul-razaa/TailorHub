import React from "react";
import { cn } from "@/lib/utils";

const Button = React.forwardRef(({ className, variant = "default", size = "default", children, ...props }, ref) => {
  const baseClass = "btn d-inline-flex align-items-center justify-content-center gap-2 fw-medium";
  
  const variants = {
    default: "btn-accent",
    outline: "btn-outline-secondary",
    ghost: "btn-link text-muted text-decoration-none p-1",
    destructive: "btn-danger",
  };

  const sizes = {
    default: "",
    sm: "btn-sm",
    lg: "btn-lg",
    icon: "btn-sm p-2",
  };

  return React.createElement('button', {
    ref,
    className: cn(baseClass, variants[variant] || variants.default, sizes[size] || '', className),
    ...props
  }, children);
});
Button.displayName = "Button";

export { Button };

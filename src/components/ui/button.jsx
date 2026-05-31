import React from "react";
import { cn } from "@/lib/utils";

const Button = React.forwardRef(({ className, variant = "default", size = "default", children, ...props }, ref) => {
  const baseClass = "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    default: "bg-amber-600 text-white hover:bg-amber-700 shadow-sm",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  };

  const sizes = {
    default: "h-10 px-4 py-2 rounded-md text-sm",
    sm: "h-8 px-3 py-1 rounded-md text-xs",
    lg: "h-12 px-6 py-3 rounded-md text-base",
    icon: "h-10 w-10 p-2 rounded-md",
  };

  return (
    <button
      ref={ref}
      className={cn(baseClass, variants[variant] || variants.default, sizes[size] || sizes.default, className)}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = "Button";

export { Button };

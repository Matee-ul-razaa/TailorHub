import React from "react";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef(({ className, value = 0, ...props }, ref) =>
  React.createElement('div', { ref, className: cn("th-progress", className), ...props },
    React.createElement('div', { className: "th-progress-bar", style: { width: `${value}%` } })
  )
);
Progress.displayName = "Progress";

export { Progress };

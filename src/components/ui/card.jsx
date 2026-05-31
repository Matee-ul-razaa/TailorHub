import React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef(({ className, children, ...props }, ref) =>
  React.createElement('div', { ref, className: cn("th-card-static", className), ...props }, children)
);
Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, children, ...props }, ref) =>
  React.createElement('div', { ref, className: cn("p-4 pb-2", className), ...props }, children)
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(({ className, children, ...props }, ref) =>
  React.createElement('h5', { ref, className: cn("font-playfair fw-semibold mb-1", className), ...props }, children)
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(({ className, children, ...props }, ref) =>
  React.createElement('p', { ref, className: cn("text-muted small mb-0", className), ...props }, children)
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(({ className, children, ...props }, ref) =>
  React.createElement('div', { ref, className: cn("p-4", className), ...props }, children)
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(({ className, children, ...props }, ref) =>
  React.createElement('div', { ref, className: cn("p-4 pt-0", className), ...props }, children)
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

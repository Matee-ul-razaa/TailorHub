import React from "react";
import { Toaster as Sonner, toast } from "sonner";

const Toaster = ({ ...props }) => {
  return React.createElement(Sonner, {
    theme: "light",
    className: "toaster group",
    position: "top-right",
    richColors: true,
    ...props
  });
};

export { Toaster, toast };

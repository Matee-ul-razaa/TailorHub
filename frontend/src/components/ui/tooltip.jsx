import React from "react";

const TooltipProvider = ({ children }) => React.createElement(React.Fragment, null, children);
const Tooltip = ({ children }) => React.createElement(React.Fragment, null, children);
const TooltipTrigger = ({ children }) => React.createElement(React.Fragment, null, children);
const TooltipContent = ({ children }) => null;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

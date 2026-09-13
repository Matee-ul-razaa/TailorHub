import React from "react";

/* Simplified Select using native <select> with custom styling */

const Select = ({ value, onValueChange, children, className }) => {
  return React.createElement('select', {
    className: `th-select ${className || ''}`,
    value: value || '',
    onChange: (e) => onValueChange && onValueChange(e.target.value),
  }, children);
};

const SelectContent = ({ children }) => React.createElement(React.Fragment, null, children);
const SelectTrigger = ({ children }) => React.createElement(React.Fragment, null, children);
const SelectValue = ({ placeholder }) => React.createElement('option', { value: '', disabled: true }, placeholder || 'Select...');

const SelectItem = ({ value, children }) => {
  return React.createElement('option', { value }, children);
};

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };

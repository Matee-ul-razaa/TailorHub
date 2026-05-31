import React from "react";

/* Simple Tabs component using Bootstrap nav-tabs pattern */
const TabsContext = React.createContext({ value: '', onChange: () => {} });

const Tabs = ({ defaultValue, value, onValueChange, children, className }) => {
  const [currentValue, setCurrentValue] = React.useState(value || defaultValue || '');
  
  React.useEffect(() => {
    if (value !== undefined) setCurrentValue(value);
  }, [value]);

  const handleChange = (val) => {
    setCurrentValue(val);
    if (onValueChange) onValueChange(val);
  };

  return React.createElement(TabsContext.Provider, { value: { value: currentValue, onChange: handleChange } },
    React.createElement('div', { className: className || '' }, children)
  );
};

const TabsList = ({ children, className }) => {
  return React.createElement('div', {
    className: `d-flex gap-1 p-1 rounded-3 mb-4 ${className || ''}`,
    style: { background: '#e9ecef' }
  }, children);
};

const TabsTrigger = ({ value, children, className }) => {
  const ctx = React.useContext(TabsContext);
  const isActive = ctx.value === value;
  return React.createElement('button', {
    className: `th-filter-btn flex-grow-1 ${isActive ? 'active' : ''} ${className || ''}`,
    onClick: () => ctx.onChange(value),
  }, children);
};

const TabsContent = ({ value, children, className }) => {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return React.createElement('div', { className: `anim-fade-in ${className || ''}` }, children);
};

export { Tabs, TabsContent, TabsList, TabsTrigger };

import React from 'react';

const GradientButton = ({ children, className = '', onClick, type = 'button', disabled = false, ...props }) => {
  return (
    <button 
      type={type} 
      onClick={onClick} 
      className={`btn-gradient ${className}`} 
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default GradientButton;

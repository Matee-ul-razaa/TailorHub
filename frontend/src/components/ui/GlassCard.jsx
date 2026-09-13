import React from 'react';

const GlassCard = ({ children, className = '', style = {}, ...props }) => {
  return (
    <div className={`glass-card p-4 ${className}`} style={style} {...props}>
      {children}
    </div>
  );
};

export default GlassCard;

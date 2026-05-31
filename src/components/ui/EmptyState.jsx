import React from 'react';
import { PackageOpen } from 'lucide-react';
import GlassCard from './GlassCard';
import GradientButton from './GradientButton';

const EmptyState = ({ 
  icon: Icon = PackageOpen, 
  title = "No Items Found", 
  description = "There is nothing to display here at the moment.",
  actionText,
  onAction
}) => {
  return (
    <GlassCard className="text-center p-5 my-4 mx-auto" style={{ maxWidth: 500 }}>
      <div className="d-flex align-items-center justify-content-center mx-auto mb-4 rounded-circle bg-light bg-opacity-25" style={{ width: 80, height: 80, color: 'var(--th-accent)' }}>
        <Icon size={40} />
      </div>
      <h4 className="fw-bold mb-2">{title}</h4>
      <p className="text-muted mb-4">{description}</p>
      
      {actionText && onAction && (
        <GradientButton onClick={onAction}>
          {actionText}
        </GradientButton>
      )}
    </GlassCard>
  );
};

export default EmptyState;

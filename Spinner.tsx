import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-3',
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-solid border-[#14b8a6] border-t-transparent ${sizeMap[size]} ${className}`}
      role="status"
      aria-label="جار التحميل..."
    />
  );
};

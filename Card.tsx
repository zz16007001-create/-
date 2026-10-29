import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

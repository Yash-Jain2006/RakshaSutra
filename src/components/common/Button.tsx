import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  isLoading,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  // These map to standard Tailwind or CSS variable classes
  const variantClasses = {
    primary: 'bg-[var(--brand-purple)] text-white hover:bg-[var(--brand-blue)] shadow-[var(--glow-primary)] focus:ring-[var(--brand-purple)] border border-transparent',
    secondary: 'bg-[var(--bg-dark-surface)] text-white border border-white/20 hover:bg-white/10 backdrop-blur-md focus:ring-white/50',
    danger: 'bg-[var(--brand-red)] text-white hover:bg-[var(--brand-red-dark)] shadow-[var(--glow-danger)] focus:ring-[var(--brand-red)] border border-transparent',
    ghost: 'bg-transparent text-[var(--brand-purple)] hover:bg-[var(--brand-purple)]/10 focus:ring-[var(--brand-purple)] border border-transparent',
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-[13.5px]',
    lg: 'px-8 py-4 text-base',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = disabled || isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer';

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${disabledClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : leftIcon ? (
        <span className="mr-2 flex items-center">{leftIcon}</span>
      ) : null}
      
      {children}
      
      {!isLoading && rightIcon && (
        <span className="ml-2 flex items-center">{rightIcon}</span>
      )}
    </button>
  );
};

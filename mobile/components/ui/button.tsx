import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  isLoading?: boolean;
  className?: string;
  textClassName?: string;
}

export function Button({ 
  className, 
  variant = 'default', 
  size = 'default', 
  isLoading,
  textClassName,
  children,
  disabled,
  ...props 
}: ButtonProps) {
  const baseStyles = "flex-row items-center justify-center rounded-md font-medium px-4";
  
  const variants = {
    default: "bg-slate-900",
    outline: "border border-slate-200 bg-transparent",
    ghost: "bg-transparent",
  };

  const sizes = {
    default: "h-10 py-2",
    sm: "h-9 px-3",
    lg: "h-11 px-8",
  };

  const textVariants = {
    default: "text-white",
    outline: "text-slate-900",
    ghost: "text-slate-900",
  };

  return (
    <TouchableOpacity
      className={twMerge(
        baseStyles,
        variants[variant],
        sizes[size],
        disabled && "opacity-50",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'default' ? 'white' : 'black'} />
      ) : (
        <Text className={twMerge("font-semibold", textVariants[variant], textClassName)}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

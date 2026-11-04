import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';
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
  const baseStyles = "flex-row items-center justify-center rounded-2xl px-5";
  
  const variants = {
    default: "bg-brand-800",
    outline: "border border-line bg-white",
    ghost: "bg-transparent",
  };

  const sizes = {
    default: "min-h-[52px] py-3",
    sm: "min-h-[44px] px-4 py-2",
    lg: "min-h-[56px] px-6 py-4",
  };

  const textVariants = {
    default: "text-white",
    outline: "text-ink",
    ghost: "text-brand-800",
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!isLoading, busy: !!isLoading }}
      activeOpacity={0.75}
      className={twMerge(
        baseStyles,
        variants[variant],
        sizes[size],
        (disabled || isLoading) && "opacity-50",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator accessibilityLabel="Please wait" color={variant === 'default' ? 'white' : '#174d45'} />
      ) : (
        typeof children === 'string' ? (
          <Text className={twMerge("font-bold text-base text-center leading-6", textVariants[variant], textClassName)}>
            {children}
          </Text>
        ) : (
          children
        )
      )}
    </TouchableOpacity>
  );
}

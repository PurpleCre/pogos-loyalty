import { forwardRef, type ComponentRef } from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

// Keep the native interaction API while making small icon/link controls usable.
export const TouchTarget = forwardRef<ComponentRef<typeof TouchableOpacity>, TouchableOpacityProps & { className?: string }>(
  function TouchTarget({ className, disabled, accessibilityRole = 'button', accessibilityState, activeOpacity = 0.75, ...props }, ref) {
    return <TouchableOpacity ref={ref} {...props} accessibilityRole={accessibilityRole} activeOpacity={activeOpacity} disabled={disabled}
      accessibilityState={accessibilityState}
      aria-checked={props['aria-checked'] ?? accessibilityState?.checked}
      aria-selected={props['aria-selected'] ?? accessibilityState?.selected}
      aria-expanded={props['aria-expanded'] ?? accessibilityState?.expanded}
      aria-busy={props['aria-busy'] ?? accessibilityState?.busy}
      aria-disabled={props['aria-disabled'] ?? (disabled || accessibilityState?.disabled)}
      className={twMerge('min-h-[44px] min-w-[44px]', disabled && 'opacity-50', className)} />;
  },
);

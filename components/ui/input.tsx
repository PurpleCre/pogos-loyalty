import { TextInput, TextInputProps } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { forwardRef, type ComponentRef } from 'react';

interface InputProps extends TextInputProps {
  className?: string;
}

export const Input = forwardRef<ComponentRef<typeof TextInput>, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      className={twMerge(
        "min-h-[52px] w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink",
        className
      )}
      placeholderTextColor="#71847a"
      selectionColor="#247266"
      {...props}
    />
  );
});

import { TextInput, TextInputProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

interface InputProps extends TextInputProps {
  className?: string;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <TextInput
      className={twMerge(
        "min-h-[52px] w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink",
        className
      )}
      placeholderTextColor="#71847a"
      selectionColor="#247266"
      {...props}
    />
  );
}

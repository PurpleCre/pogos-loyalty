import { Image } from 'expo-image';
import logo from '@/assets/brand/pogos-logo.webp';

export function BrandLogo({ size = 64 }: { size?: number }) {
  return <Image source={logo} style={{ width: size, height: size }}
    contentFit="contain" accessibilityLabel="Pogo’s Pizza & Chicken" />;
}

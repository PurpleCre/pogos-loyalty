import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { ShoppingBag } from 'lucide-react-native';

export function CatalogueImage({ uri, label, className, contentFit = 'contain' }: {
  uri?: string | null; label: string; className: string; contentFit?: 'cover' | 'contain';
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View className={`${className} overflow-hidden items-center justify-center bg-white`}>
    {uri && !failed ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit={contentFit}
      cachePolicy="memory-disk" recyclingKey={uri} accessibilityLabel={label} onError={() => setFailed(true)} />
      : <ShoppingBag color="#73a69b" size={32} accessibilityLabel={`No photo available for ${label}`} />}
  </View>;
}

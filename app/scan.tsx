import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Text, View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useRewards } from '@/hooks/useRewards';

export default function Scan() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { addPoints } = useRewards();

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View className="flex-1 justify-center items-center bg-white p-6">
        <Text className="text-center mb-4 text-slate-600">
          We need your permission to show the camera
        </Text>
        <Button onPress={requestPermission}>Grant Permission</Button>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    // Mock logic based on original qr-scanner.tsx (points added)
    // In a real app, we'd parse this data securely. 
    // For now assuming the QR code just contains a confirmation string or ID.
    
    Alert.alert(
      "Code Scanned",
      `Data: ${data}\n\nAdd points?`,
      [
        {
          text: "Cancel",
          onPress: () => {
            setScanned(false);
          },
          style: "cancel"
        },
        {
          text: "Add Points",
          onPress: async () => {
            // Mocking adding points for demo
            // In reality, 'data' would be parsed to determine rewards.
            const { error } = await addPoints(50, 0, ['QR Scan Reward']);
            
            if (error) {
              Alert.alert("Error", error);
            } else {
              Alert.alert("Success", "50 Points added!");
              router.back();
            }
            setScanned(false);
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 justify-center">
      <CameraView 
        style={styles.camera} 
        facing={facing}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        <View className="flex-1 bg-black/50 justify-between py-12 px-6">
          <View className="items-end">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 bg-white/20 items-center justify-center rounded-full"
            >
              <X color="white" size={24} />
            </TouchableOpacity>
          </View>

          <View className="items-center">
             <View className="w-64 h-64 border-2 border-white rounded-xl bg-transparent" />
             <Text className="text-white mt-4 font-medium">Align QR code within frame</Text>
          </View>
          
          <View /> 
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
});

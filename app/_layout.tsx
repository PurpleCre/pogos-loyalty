import "../global.css";
import { Slot } from "expo-router";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartProvider } from '@/contexts/CartContext';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <Slot />
      </CartProvider>
    </QueryClientProvider>
  );
}

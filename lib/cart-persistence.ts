import AsyncStorage from '@react-native-async-storage/async-storage';
import { runtimeEnvironment } from './environment';
import { createCartRepository } from './cart-storage';
export const cartRepository = createCartRepository(AsyncStorage, runtimeEnvironment.name);

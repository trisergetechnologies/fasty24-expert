import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { attachNotificationListeners, registerForPushNotifications } from '../lib/push';
import { OfferProvider } from '../lib/offerContext';
import ForceUpdateGate from '../lib/ForceUpdateGate';
import '../lib/jobLocationTask';

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotifications();
    const detach = attachNotificationListeners();
    return detach;
  }, []);

  return (
    <SafeAreaProvider>
      <ForceUpdateGate>
        <OfferProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="onboarding/index" />
            <Stack.Screen name="onboarding/deposit" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="job/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="estimate/[bookingId]" options={{ presentation: 'card' }} />
          </Stack>
        </OfferProvider>
      </ForceUpdateGate>
    </SafeAreaProvider>
  );
}

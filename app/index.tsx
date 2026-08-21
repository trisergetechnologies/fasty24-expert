import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getToken } from '../lib/storage';
import { getMe } from '../lib/api';
import { colors } from '../constants/theme';

export default function AuthGate() {
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      try {
        const expert = await getMe();
        if (expert.kycStatus !== 'verified') {
          router.replace('/onboarding');
          return;
        }
        router.replace('/(tabs)/home');
      } catch {
        router.replace('/login');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.black }}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color={colors.yellow} />
    </View>
  );
}

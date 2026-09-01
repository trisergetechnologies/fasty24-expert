import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMe } from '../../lib/api';
import { requestHomePermissions } from '../../lib/permissions';
import { colors } from '../../constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  focused,
  active,
  inactive,
  size = 22,
}: {
  focused: boolean;
  active: IconName;
  inactive: IconName;
  size?: number;
}) {
  return (
    <Ionicons
      name={focused ? active : inactive}
      size={size}
      color={focused ? colors.yellow : colors.tabInactive}
    />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const expert = await getMe();
        if (cancelled) return;
        if (expert.kycStatus !== 'verified') {
          router.replace('/onboarding');
          return;
        }
        setReady(true);
        void requestHomePermissions();
      } catch {
        if (!cancelled) router.replace('/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.light }}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    );
  }

  const bottomPad = Math.max(8, insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.black,
          borderTopWidth: 0,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.yellow,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} active="home" inactive="home-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'My Jobs',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} active="briefcase" inactive="briefcase-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} active="wallet" inactive="wallet-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} active="person" inactive="person-outline" />
          ),
        }}
      />
    </Tabs>
  );
}

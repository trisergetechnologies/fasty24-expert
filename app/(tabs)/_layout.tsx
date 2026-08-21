import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.black,
          borderTopWidth: 0,
          height: 64,
          paddingBottom: 8,
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

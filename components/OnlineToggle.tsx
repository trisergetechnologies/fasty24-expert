import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { goOnline, goOffline } from '../lib/api';
import { startOnlinePresence, stopOnlinePresence, startJobLocationTracking } from '../lib/presence';
import { registerForPushNotifications, requestNotificationPermission } from '../lib/push';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  initialOnline?: boolean;
  kycStatus?: string;
  jobLocked?: boolean;
  activeBookingId?: string | null;
  onStatusChange?: (online: boolean) => void;
}

export default function OnlineToggle({
  initialOnline = false,
  kycStatus,
  jobLocked = false,
  activeBookingId,
  onStatusChange,
}: Props) {
  const [isOnline, setIsOnline] = useState(initialOnline);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsOnline(initialOnline);
    if (jobLocked && activeBookingId) {
      void startJobLocationTracking(activeBookingId);
    } else if (initialOnline) {
      void startOnlinePresence();
    }
  }, [initialOnline, jobLocked, activeBookingId]);

  async function toggle(value: boolean) {
    if (!value && jobLocked) {
      Alert.alert(
        'Job in progress',
        'Finish your current job before going offline.',
      );
      return;
    }
    if (value && kycStatus && kycStatus !== 'verified') {
      Alert.alert(
        'KYC required',
        'Complete onboarding and wait for admin approval before going online.',
      );
      return;
    }
    setLoading(true);
    try {
      if (value) {
        const notifyOk = await requestNotificationPermission();
        if (!notifyOk) {
          Alert.alert(
            'Notifications required',
            'Allow notifications so you hear new job offers even when the app is in the background.',
          );
          setLoading(false);
          return;
        }
        await registerForPushNotifications();

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location required',
            'Location permission is needed to go online and receive jobs.',
          );
          setLoading(false);
          return;
        }
        const { coords } = await Location.getCurrentPositionAsync({});
        await goOnline(coords.latitude, coords.longitude);
        await startOnlinePresence();
      } else {
        await stopOnlinePresence();
        await goOffline();
      }
      setIsOnline(value);
      onStatusChange?.(value);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not update status.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, isOnline ? styles.online : styles.offline]}>
      <View style={styles.left}>
        <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        <View>
          <Text style={[styles.label, !isOnline && styles.labelOffline]}>
            {isOnline ? 'You are Online' : 'You are Offline'}
          </Text>
          <Text style={[styles.sub, !isOnline && styles.subOffline]}>
            {jobLocked
              ? 'On a job — finish it before going offline'
              : isOnline
                ? 'Ready to receive job requests'
                : 'Toggle to start accepting jobs'}
          </Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={isOnline ? colors.black : colors.yellow} />
      ) : (
        <Switch
          value={isOnline}
          onValueChange={toggle}
          disabled={jobLocked}
          trackColor={{ false: colors.darkBorder, true: colors.yellow }}
          thumbColor={colors.white}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  online: {
    backgroundColor: colors.yellow,
  },
  offline: {
    backgroundColor: colors.darkSurface,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  dotOnline: {
    backgroundColor: colors.black,
  },
  dotOffline: {
    backgroundColor: colors.tabInactive,
  },
  label: {
    fontWeight: '800',
    fontSize: 15,
    color: colors.black,
  },
  labelOffline: {
    color: colors.white,
  },
  sub: {
    fontSize: 12,
    color: colors.darkSurfaceAlt,
    marginTop: 1,
  },
  subOffline: {
    color: colors.darkMuted,
  },
});

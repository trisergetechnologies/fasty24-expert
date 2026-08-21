import { useState, useRef, useEffect } from 'react';
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
import { emitLocation } from '../lib/socket';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  initialOnline?: boolean;
  onStatusChange?: (online: boolean) => void;
}

export default function OnlineToggle({ initialOnline = false, onStatusChange }: Props) {
  const [isOnline, setIsOnline] = useState(initialOnline);
  const [loading, setLoading] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  async function startHeartbeat() {
    const sendLocation = async () => {
      try {
        const { coords } = await Location.getCurrentPositionAsync({});
        emitLocation(coords.latitude, coords.longitude);
      } catch {}
    };
    await sendLocation();
    heartbeatRef.current = setInterval(sendLocation, 15_000);
  }

  function stopHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  async function toggle(value: boolean) {
    setLoading(true);
    try {
      if (value) {
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
        await startHeartbeat();
      } else {
        stopHeartbeat();
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
        <View style={[styles.dot, isOnline ? styles.dotGreen : styles.dotGray]} />
        <View>
          <Text style={[styles.label, !isOnline && styles.labelOffline]}>
            {isOnline ? 'You are Online' : 'You are Offline'}
          </Text>
          <Text style={[styles.sub, !isOnline && styles.subOffline]}>
            {isOnline ? 'Ready to receive job requests' : 'Toggle to start accepting jobs'}
          </Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={isOnline ? colors.black : colors.yellow} />
      ) : (
        <Switch
          value={isOnline}
          onValueChange={toggle}
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
  dotGreen: {
    backgroundColor: '#0D0D0D',
  },
  dotGray: {
    backgroundColor: '#555',
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
    color: '#555',
    marginTop: 1,
  },
  subOffline: {
    color: colors.darkMuted,
  },
});

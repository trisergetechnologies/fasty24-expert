import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, gradients } from '../constants/theme';

interface Props {
  /** ISO timestamp of when the job clock started. */
  startedAt: string;
  /** Allotted duration for the job, in minutes (optional). */
  durationMin?: number | null;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function JobTimer({ startedAt, durationMin }: Props) {
  const startedAtMs = new Date(startedAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const elapsedSec = Number.isFinite(startedAtMs) ? Math.max(0, (now - startedAtMs) / 1000) : 0;
  const allottedSec = typeof durationMin === 'number' && durationMin > 0 ? durationMin * 60 : null;
  const isOvertime = allottedSec !== null && elapsedSec > allottedSec;
  const progress = allottedSec ? Math.min(1, elapsedSec / allottedSec) : null;
  const overtimeSec = isOvertime && allottedSec ? elapsedSec - allottedSec : 0;

  return (
    <LinearGradient
      colors={isOvertime ? gradients.overtime : gradients.darkDeep}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
        <Text style={[styles.liveLabel, isOvertime && styles.liveLabelOvertime]}>
          {isOvertime ? 'RUNNING OVERTIME' : 'JOB IN PROGRESS'}
        </Text>
        <Ionicons
          name="timer-outline"
          size={16}
          color={isOvertime ? colors.white : colors.yellow}
          style={styles.timerIcon}
        />
      </View>

      <Text style={styles.clock}>{formatClock(elapsedSec)}</Text>
      <Text style={styles.clockLabel}>Elapsed time</Text>

      {allottedSec !== null && (
        <>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                isOvertime && styles.fillOvertime,
                { width: `${Math.max(4, (progress ?? 0) * 100)}%` },
              ]}
            />
          </View>
          <Text style={[styles.remaining, isOvertime && styles.remainingOvertime]}>
            {isOvertime
              ? `+${formatClock(overtimeSec)} over the ${durationMin} min estimate`
              : `${formatClock(Math.max(0, (allottedSec ?? 0) - elapsedSec))} remaining of ${durationMin} min`}
          </Text>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.dark,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.yellow,
    marginRight: spacing.xs,
  },
  liveLabel: {
    flex: 1,
    color: colors.yellow,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveLabelOvertime: {
    color: colors.white,
  },
  timerIcon: {
    marginLeft: spacing.xs,
  },
  clock: {
    color: colors.white,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 1,
  },
  clockLabel: {
    color: colors.darkMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.yellow,
  },
  fillOvertime: {
    backgroundColor: colors.white,
  },
  remaining: {
    color: colors.darkMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  remainingOvertime: {
    color: colors.white,
  },
});

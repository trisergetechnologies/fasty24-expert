import { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from './GradientButton';
import { colors, spacing, radius, shadows, gradients } from '../constants/theme';
import { formatInr } from '../lib/booking';

interface Props {
  visible: boolean;
  earning: number;
  durationLabel?: string | null;
  customerName?: string;
  onDone: () => void;
}

const SPARK_COUNT = 8;

export default function JobCompleteModal({ visible, earning, durationLabel, customerName, onDone }: Props) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const sparks = useRef(
    Array.from({ length: SPARK_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.4);
    opacity.setValue(0);
    sparks.forEach((s) => s.setValue(0));

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.stagger(
        45,
        sparks.map((s) =>
          Animated.timing(s, {
            toValue: 1,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [visible, opacity, scale, sparks]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            {sparks.map((s, i) => {
              const angle = (i / SPARK_COUNT) * Math.PI * 2;
              const distance = 60;
              const translateX = s.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] });
              const translateY = s.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] });
              const sparkOpacity = s.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0] });
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.spark,
                    i % 2 === 0 ? styles.sparkYellow : styles.sparkSuccess,
                    { opacity: sparkOpacity, transform: [{ translateX }, { translateY }] },
                  ]}
                />
              );
            })}
            <LinearGradient colors={gradients.success} style={styles.iconCircle}>
              <Ionicons name="checkmark" size={44} color={colors.white} />
            </LinearGradient>
          </View>

          <Text style={styles.title}>Job Completed!</Text>
          <Text style={styles.subtitle}>
            Great work{customerName ? `, that was for ${customerName}` : ''}! Thank you for
            delivering an excellent service — every job you complete builds your reputation on
            Fasty24.
          </Text>

          <LinearGradient colors={gradients.dark} style={styles.earningCard}>
            <Text style={styles.earningLabel}>You earned</Text>
            <Text style={styles.earningValue}>₹{formatInr(earning)}</Text>
            {!!durationLabel && <Text style={styles.earningMeta}>Completed in {durationLabel}</Text>}
          </LinearGradient>

          <GradientButton title="Continue" onPress={onDone} style={styles.cta} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.dark,
  },
  iconWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  spark: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: '50%',
    left: '50%',
    marginTop: -4,
    marginLeft: -4,
  },
  sparkYellow: {
    backgroundColor: colors.yellow,
  },
  sparkSuccess: {
    backgroundColor: colors.success,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.black,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  earningCard: {
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  earningLabel: {
    color: colors.darkMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  earningValue: {
    color: colors.yellow,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 2,
  },
  earningMeta: {
    color: colors.darkMuted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  cta: {
    width: '100%',
  },
});

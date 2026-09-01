import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { respondToOffer, type Offer } from '../lib/api';
import { formatInr, formatDateTime } from '../lib/booking';
import { stopJobBuzzer } from '../lib/jobAlert';
import { markOnJob } from '../lib/presence';
import { colors, spacing, radius, shadows, gradients } from '../constants/theme';

interface Props {
  offer: Offer;
  onResponded: () => void;
  fullscreen?: boolean;
}

export default function OfferCard({ offer, onResponded, fullscreen = false }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(1, Math.floor(offer.offerExpiresInSec || 60)),
  );
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [expired, setExpired] = useState(false);
  const expiredRef = useRef(false);

  const busy = accepting || declining;

  useEffect(() => {
    setSecondsLeft(Math.max(1, Math.floor(offer.offerExpiresInSec || 60)));
    expiredRef.current = false;
    setExpired(false);
    setAccepting(false);
    setDeclining(false);
  }, [offer.bookingId, offer.offerExpiresInSec]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [offer.bookingId]);

  useEffect(() => {
    if (secondsLeft > 0 || expiredRef.current) return;
    expiredRef.current = true;
    setExpired(true);
    void stopJobBuzzer();
    onResponded();
  }, [secondsLeft, onResponded]);

  async function respond(accepted: boolean) {
    if (busy || expiredRef.current) return;
    if (accepted) setAccepting(true);
    else setDeclining(true);
    try {
      await respondToOffer(offer.bookingId, accepted);
      onResponded();
      if (accepted) {
        markOnJob(offer.bookingId);
        router.push(`/job/${offer.bookingId}`);
      }
    } catch (err: any) {
      Alert.alert(
        accepted ? 'Could not accept' : 'Could not decline',
        err?.message ?? 'Please try again.',
      );
    } finally {
      setAccepting(false);
      setDeclining(false);
    }
  }

  const distanceLabel =
    typeof offer.customerDistance === 'number' && offer.customerDistance > 0
      ? `${offer.customerDistance.toFixed(1)} km`
      : '—';
  const etaLabel = offer.eta > 0 ? `${offer.eta} min` : '—';
  const urgency = secondsLeft <= 10;

  const inner = (
    <View style={[styles.card, fullscreen && styles.cardFull]}>
      <View style={styles.topRow}>
        <Text style={styles.badge}>{expired ? 'EXPIRED' : 'NEW JOB'}</Text>
        <View style={[styles.timerChip, (urgency || expired) && styles.timerChipUrgent]}>
          <Text style={[styles.timerText, (urgency || expired) && styles.timerTextUrgent]}>
            {expired ? '0s' : `${secondsLeft}s`}
          </Text>
        </View>
      </View>

      <Text style={[styles.service, fullscreen && styles.serviceFull]} numberOfLines={3}>
        {offer.serviceName || 'Service request'}
      </Text>

      {!!offer.address && (
        <Text style={styles.address} numberOfLines={3}>
          {offer.address}
        </Text>
      )}

      <View style={styles.metaRow}>
        <Meta label="Distance" value={distanceLabel} />
        <Meta label="ETA" value={etaLabel} />
        <Meta label="Earn" value={`₹${formatInr(offer.expertEarning)}`} highlight />
      </View>

      {!!offer.scheduledAt && (
        <Text style={styles.scheduled}>
          Scheduled · {formatDateTime(offer.scheduledAt)}
        </Text>
      )}

      {expired ? (
        <View style={styles.expiredBox}>
          <Text style={styles.expiredText}>Offer expired</Text>
          <TouchableOpacity style={styles.dismissBtn} onPress={onResponded} activeOpacity={0.85}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.decline]}
            onPress={() => respond(false)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {declining ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.declineText}>Decline</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => respond(true)}
            disabled={busy}
            activeOpacity={0.85}
            style={styles.acceptWrap}
          >
            <LinearGradient colors={gradients.primary} style={[styles.btn, styles.accept]}>
              {accepting ? (
                <ActivityIndicator color={colors.black} />
              ) : (
                <Text style={styles.acceptText}>Accept</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (!fullscreen) {
    return <View style={styles.overlay}>{inner}</View>;
  }

  return (
    <View style={styles.fullRoot}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.fullSafe} edges={['top', 'bottom']}>
        {inner}
      </SafeAreaView>
    </View>
  );
}

function Meta({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, highlight && styles.metaHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  fullRoot: {
    flex: 1,
    backgroundColor: colors.black,
  },
  fullSafe: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.yellow,
    ...shadows.dark,
  },
  cardFull: {
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badge: {
    color: colors.black,
    backgroundColor: colors.yellow,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  timerChip: {
    backgroundColor: colors.darkSurfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timerChipUrgent: {
    backgroundColor: colors.error,
  },
  timerText: {
    color: colors.yellow,
    fontWeight: '800',
    fontSize: 14,
  },
  timerTextUrgent: {
    color: colors.white,
  },
  service: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  serviceFull: {
    fontSize: 28,
    marginTop: spacing.sm,
  },
  address: {
    color: colors.darkMuted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flex: 1,
    backgroundColor: colors.darkSurface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaValue: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  metaHighlight: {
    color: colors.yellow,
  },
  scheduled: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  decline: {
    backgroundColor: colors.darkSurfaceAlt,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  acceptWrap: {
    flex: 1,
  },
  accept: {},
  declineText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  acceptText: {
    color: colors.black,
    fontWeight: '900',
    fontSize: 15,
  },
  expiredBox: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  expiredText: {
    color: colors.error,
    fontWeight: '800',
    fontSize: 16,
  },
  dismissBtn: {
    backgroundColor: colors.darkSurfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    minWidth: 160,
    alignItems: 'center',
  },
  dismissText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
});

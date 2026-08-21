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
import { LinearGradient } from 'expo-linear-gradient';
import { respondToOffer, type Offer } from '../lib/api';
import { formatInr, formatDateTime } from '../lib/booking';
import { colors, spacing, radius, shadows, gradients } from '../constants/theme';

interface Props {
  offer: Offer;
  onResponded: () => void;
}

export default function OfferCard({ offer, onResponded }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(1, Math.floor(offer.offerExpiresInSec || 60)),
  );
  const [busy, setBusy] = useState(false);
  const expiredRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(Math.max(1, Math.floor(offer.offerExpiresInSec || 60)));
    expiredRef.current = false;
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
    onResponded();
  }, [secondsLeft, onResponded]);

  async function respond(accepted: boolean) {
    if (busy || expiredRef.current) return;
    setBusy(true);
    try {
      await respondToOffer(offer.bookingId, accepted);
      onResponded();
      if (accepted) {
        router.push(`/job/${offer.bookingId}`);
      }
    } catch (err: any) {
      Alert.alert(
        accepted ? 'Could not accept' : 'Could not decline',
        err?.message ?? 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const distanceLabel =
    typeof offer.customerDistance === 'number'
      ? `${offer.customerDistance.toFixed(1)} km`
      : '—';
  const etaLabel = offer.eta > 0 ? `${offer.eta} min` : '—';
  const urgency = secondsLeft <= 10;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.badge}>NEW JOB</Text>
          <View style={[styles.timerChip, urgency && styles.timerChipUrgent]}>
            <Text style={[styles.timerText, urgency && styles.timerTextUrgent]}>
              {secondsLeft}s
            </Text>
          </View>
        </View>

        <Text style={styles.service} numberOfLines={2}>
          {offer.serviceName || 'Service request'}
        </Text>

        {!!offer.address && (
          <Text style={styles.address} numberOfLines={2}>
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

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.decline]}
            onPress={() => respond(false)}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
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
              {busy ? (
                <ActivityIndicator color={colors.black} />
              ) : (
                <Text style={styles.acceptText}>Accept</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
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
  card: {
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.yellow,
    ...shadows.dark,
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
    backgroundColor: '#222',
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
  address: {
    color: '#aaa',
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
    backgroundColor: '#1a1a1a',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  metaLabel: {
    color: '#888',
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
    color: '#888',
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
    minHeight: 48,
  },
  decline: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
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
});

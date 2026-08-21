import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { getDashboard, getMe, getPendingOffer } from '../../lib/api';
import type { DashboardData, Expert, Offer } from '../../lib/api';
import { connectSocket, onOffer } from '../../lib/socket';
import { presentForegroundJobAlert } from '../../lib/push';
import { normalizeOffer, formatInr, formatDateTime } from '../../lib/booking';
import OnlineToggle from '../../components/OnlineToggle';
import StatusBadge from '../../components/StatusBadge';
import OfferCard from '../../components/OfferCard';
import { colors, spacing, radius, shadows, common, gradients } from '../../constants/theme';

export default function HomeScreen() {
  const [expert, setExpert] = useState<Expert | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerRef = useRef<Offer | null>(null);

  useEffect(() => {
    offerRef.current = offer;
  }, [offer]);

  async function load() {
    try {
      const [d, e] = await Promise.all([getDashboard(), getMe()]);
      setData(d);
      setExpert(e);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load your dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Realtime offers via socket; slow poll only as fallback when online
  useEffect(() => {
    let cancelled = false;
    let unsubOffer: (() => void) | undefined;

    (async () => {
      await connectSocket();
      if (cancelled) return;

      unsubOffer = onOffer((o) => {
        const normalized = normalizeOffer(o);
        setOffer(normalized);
        presentForegroundJobAlert(normalized?.bookingId);
      });
    })();

    return () => {
      cancelled = true;
      unsubOffer?.();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();

      async function checkPendingOffer() {
        if (offerRef.current) return;
        try {
          const pending = await getPendingOffer();
          const normalized = normalizeOffer(pending);
          if (normalized) {
            setOffer((prev) => prev ?? normalized);
          }
        } catch {
          // ignore
        }
      }

      checkPendingOffer();

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(checkPendingOffer, 30_000);

      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }, []),
  );

  function onOfferResponded() {
    setOffer(null);
  }

  if (loading) {
    return (
      <SafeAreaView style={[common.screen, styles.center]} edges={['top']}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.yellow} />
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={[common.screen, styles.center]} edges={['top']}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const firstName = expert?.name?.split(' ')[0] ?? 'Expert';

  return (
    <SafeAreaView style={common.screen} edges={['top']}>
      <StatusBar style="dark" />
      {offer && (
        <OfferCard
          offer={offer}
          onResponded={onOfferResponded}
        />
      )}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.yellow]} tintColor={colors.yellow} />}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>Showing saved data — {error}</Text>
          </View>
        )}
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <View style={styles.ratingChip}>
            <Text style={styles.ratingText}>⭐ {expert?.rating?.toFixed(1) ?? '—'}</Text>
          </View>
        </View>

        {/* Online toggle */}
        <OnlineToggle initialOnline={expert?.isOnline ?? false} />

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Today's Jobs" value={String(data?.todayJobs ?? 0)} accent />
          <StatCard
            label="Today's Earnings"
            value={`₹${(data?.todayEarnings ?? 0).toLocaleString()}`}
          />
          <StatCard
            label="Commission"
            value={`${((data?.commissionRate ?? 0) * 100).toFixed(0)}%`}
          />
        </View>

        {/* Recent orders */}
        <Text style={[common.sectionTitle, { marginTop: spacing.lg }]}>Recent Orders</Text>
        {!data?.recentOrders?.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No recent orders</Text>
          </View>
        ) : (
          data.recentOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={[common.card, styles.orderCard]}
              onPress={() => router.push(`/job/${order.id}`)}
            >
              <View style={common.between}>
                <Text style={styles.orderService} numberOfLines={1}>
                  {order.serviceName}
                </Text>
                <StatusBadge status={order.status} />
              </View>
              <Text style={styles.orderCustomer}>{order.customerName}</Text>
              <View style={[common.between, { marginTop: spacing.xs }]}>
                <Text style={styles.orderDate}>{formatDateTime(order.scheduledAt)}</Text>
                <Text style={styles.orderAmount}>₹{formatInr(order.expertEarning)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  if (accent) {
    return (
      <LinearGradient colors={gradients.darkDeep} style={styles.statCard}>
        <Text style={[styles.statValue, styles.statValueAccent]}>{value}</Text>
        <Text style={[styles.statLabel, styles.statLabelAccent]}>{label}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '500',
  },
  name: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.black,
  },
  ratingChip: {
    backgroundColor: colors.yellow,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  ratingText: {
    fontWeight: '800',
    fontSize: 14,
    color: colors.black,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    ...shadows.card,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.black,
  },
  statValueAccent: {
    color: colors.yellow,
  },
  statLabel: {
    fontSize: 10,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },
  statLabelAccent: {
    color: colors.darkMuted,
  },
  orderCard: {
    marginBottom: spacing.sm,
  },
  orderService: {
    fontWeight: '800',
    fontSize: 15,
    color: colors.black,
    flex: 1,
    marginRight: spacing.sm,
  },
  orderCustomer: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  orderDate: {
    fontSize: 12,
    color: colors.muted,
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.black,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorText: {
    color: colors.gray,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.yellow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryBtnText: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },
});

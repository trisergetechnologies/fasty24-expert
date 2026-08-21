import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getEarnings } from '../../lib/api';
import type { EarningsSummary } from '../../lib/api';
import { formatInr, formatDateTime } from '../../lib/booking';
import SegmentedControl from '../../components/SegmentedControl';
import { colors, spacing, radius, shadows, common, gradients } from '../../constants/theme';

type Period = 'today' | 'week';

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>('today');
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPeriod: Period, { silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await getEarnings(nextPeriod);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load earnings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [period, load]),
  );

  function onChangePeriod(next: Period) {
    setPeriod(next);
    setData(null);
    setLoading(true);
  }

  const breakdown = data?.breakdown ?? [];
  const maxAmount = breakdown.reduce((max, item) => Math.max(max, item.amount), 0);

  return (
    <SafeAreaView style={common.screen} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(period, { silent: true }); }}
            colors={[colors.yellow]}
            tintColor={colors.yellow}
          />
        }
      >
        <Text style={common.sectionTitle}>Earnings</Text>

        <SegmentedControl
          value={period}
          onChange={onChangePeriod}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This Week' },
          ]}
        />

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.yellow} />
          </View>
        ) : error && !data ? (
          <View style={styles.loadingBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load(period)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <LinearGradient colors={gradients.darkDeep} style={styles.totalCard}>
              <View style={styles.totalIconWrap}>
                <Ionicons name="trending-up" size={16} color={colors.yellow} />
                <Text style={styles.totalLabel}>
                  {period === 'today' ? "Today's Earnings" : "This Week's Earnings"}
                </Text>
              </View>
              <Text style={styles.totalValue}>₹{formatInr(data?.total)}</Text>
              <View style={styles.totalMetaRow}>
                <View style={styles.totalMetaItem}>
                  <Text style={styles.totalMetaValue}>{data?.jobs ?? 0}</Text>
                  <Text style={styles.totalMetaLabel}>Jobs</Text>
                </View>
                <View style={styles.totalDivider} />
                <View style={styles.totalMetaItem}>
                  <Text style={styles.totalMetaValue}>
                    {((data?.commissionRate ?? 0) * 100).toFixed(0)}%
                  </Text>
                  <Text style={styles.totalMetaLabel}>Your Share</Text>
                </View>
              </View>
            </LinearGradient>

            <Text style={[common.sectionTitle, { fontSize: 16, marginTop: spacing.lg }]}>
              Breakdown
            </Text>
            {breakdown.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No earnings recorded for this period</Text>
              </View>
            ) : (
              breakdown.map((item) => (
                <View key={item.date} style={[common.card, styles.breakdownRow]}>
                  <View style={common.between}>
                    <Text style={styles.breakdownDate}>{formatDateTime(item.date)}</Text>
                    <Text style={styles.breakdownAmount}>₹{formatInr(item.amount)}</Text>
                  </View>
                  <Text style={styles.breakdownJobs}>{item.jobs} job{item.jobs === 1 ? '' : 's'}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: maxAmount > 0 ? `${Math.max(4, (item.amount / maxAmount) * 100)}%` : '4%' },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  totalCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.dark,
  },
  totalIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalLabel: {
    color: colors.darkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    color: colors.yellow,
    fontSize: 40,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  totalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  totalMetaItem: {
    flex: 1,
    alignItems: 'center',
  },
  totalMetaValue: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  totalMetaLabel: {
    color: colors.darkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  totalDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.darkBorder,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
  breakdownRow: {
    marginBottom: spacing.sm,
  },
  breakdownDate: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
  },
  breakdownAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.black,
  },
  breakdownJobs: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: colors.yellow,
    borderRadius: 3,
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
});

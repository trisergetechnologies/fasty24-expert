import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { listBookings } from '../../lib/api';
import type { BookingSummary } from '../../lib/api';
import { normalizeBookingSummary, formatInr, formatDateTime } from '../../lib/booking';
import StatusBadge from '../../components/StatusBadge';
import SegmentedControl from '../../components/SegmentedControl';
import { colors, spacing, radius, common } from '../../constants/theme';

type Scope = 'today' | 'history';

export default function JobsScreen() {
  const [scope, setScope] = useState<Scope>('today');
  const [jobs, setJobs] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextScope: Scope, { silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const raw = await listBookings(nextScope);
      const list = Array.isArray(raw) ? raw.map((item) => normalizeBookingSummary(item as any)) : [];
      setJobs(list);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load your jobs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(scope);
    }, [scope, load]),
  );

  function onChangeScope(next: Scope) {
    setScope(next);
    setJobs([]);
    setLoading(true);
  }

  return (
    <SafeAreaView style={common.screen} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={common.sectionTitle}>My Jobs</Text>
      </View>

      <View style={styles.controlWrap}>
        <SegmentedControl
          value={scope}
          onChange={onChangeScope}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>

      {loading ? (
        <View style={common.center}>
          <ActivityIndicator size="large" color={colors.yellow} />
        </View>
      ) : error && jobs.length === 0 ? (
        <View style={common.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(scope)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(scope, { silent: true }); }}
              colors={[colors.yellow]}
              tintColor={colors.yellow}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {scope === 'today' ? 'No jobs scheduled for today' : 'No past jobs yet'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[common.card, styles.card]}
              onPress={() => router.push(`/job/${item.id}`)}
            >
              <View style={common.between}>
                <Text style={styles.serviceName} numberOfLines={1}>{item.serviceName}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.customerName}>{item.customerName}</Text>
              <View style={[common.between, { marginTop: spacing.xs }]}>
                <Text style={styles.date}>{formatDateTime(item.scheduledAt)}</Text>
                <Text style={styles.amount}>₹{formatInr(item.expertEarning)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  controlWrap: {
    paddingHorizontal: spacing.md,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
    flexGrow: 1,
  },
  card: {
    marginBottom: spacing.sm,
  },
  serviceName: {
    fontWeight: '800',
    fontSize: 15,
    color: colors.black,
    flex: 1,
    marginRight: spacing.sm,
  },
  customerName: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: colors.muted,
  },
  amount: {
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
});

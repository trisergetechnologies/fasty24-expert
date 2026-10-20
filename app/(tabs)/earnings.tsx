import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getEarnings,
  getWallet,
  getWalletTransactions,
  requestWithdrawal,
} from '../../lib/api';
import type { EarningsSummary, ExpertWallet, WalletTransaction } from '../../lib/api';
import { formatInr, formatDateTime } from '../../lib/booking';
import SegmentedControl from '../../components/SegmentedControl';
import { colors, spacing, radius, shadows, common, gradients } from '../../constants/theme';

type Period = 'today' | 'week';

const TX_LABELS: Record<string, string> = {
  job_credit: 'Job earnings',
  admin_credit: 'Admin credit',
  withdrawal_hold: 'Withdrawal requested',
  withdrawal_paid: 'Withdrawal paid',
  withdrawal_reject_release: 'Withdrawal returned',
};

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>('today');
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [wallet, setWallet] = useState<ExpertWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async (nextPeriod: Period, { silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [earningsRes, walletRes, txRes] = await Promise.all([
        getEarnings(nextPeriod),
        getWallet(),
        getWalletTransactions(40),
      ]);
      setData(earningsRes);
      setWallet(walletRes);
      setTransactions(txRes.transactions || []);
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

  function openWithdraw() {
    if (!wallet?.bank?.hasBank) {
      Alert.alert(
        'Bank details needed',
        'Add your bank account in onboarding / profile support before withdrawing.',
      );
      return;
    }
    if ((wallet?.availableBalance ?? 0) < 1) {
      Alert.alert('No balance', 'Your wallet balance is empty.');
      return;
    }
    if ((wallet?.pendingWithdrawal ?? 0) > 0) {
      Alert.alert(
        'Request in progress',
        'You already have a withdrawal pending. Wait for admin to process it.',
      );
      return;
    }
    setWithdrawAmount(String(wallet.availableBalance));
    setWithdrawOpen(true);
  }

  async function submitWithdraw() {
    const amount = Math.round(Number(withdrawAmount));
    if (!Number.isFinite(amount) || amount < 1) {
      Alert.alert('Invalid amount', 'Enter at least ₹1.');
      return;
    }
    if (wallet && amount > wallet.availableBalance) {
      Alert.alert('Too much', `Available balance is ₹${formatInr(wallet.availableBalance)}.`);
      return;
    }
    setWithdrawing(true);
    try {
      const res = await requestWithdrawal(amount);
      setWallet({ ...res.wallet, bank: wallet?.bank || res.wallet.bank });
      setWithdrawOpen(false);
      Alert.alert(
        'Request submitted',
        `₹${formatInr(amount)} will be transferred to your bank after admin approval.`,
      );
      load(period, { silent: true });
    } catch (err: any) {
      Alert.alert('Withdrawal failed', err?.message ?? 'Please try again.');
    } finally {
      setWithdrawing(false);
    }
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
            onRefresh={() => {
              setRefreshing(true);
              load(period, { silent: true });
            }}
            colors={[colors.yellow]}
            tintColor={colors.yellow}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={common.sectionTitle}>Earnings</Text>

        {wallet && (
          <View style={[common.card, styles.walletCard]}>
            <View style={common.between}>
              <View>
                <Text style={styles.walletLabel}>Wallet balance</Text>
                <Text style={styles.walletValue}>₹{formatInr(wallet.availableBalance)}</Text>
              </View>
              <TouchableOpacity style={styles.withdrawBtn} onPress={openWithdraw} activeOpacity={0.85}>
                <Ionicons name="arrow-up-circle" size={18} color={colors.black} />
                <Text style={styles.withdrawBtnText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
            {(wallet.pendingWithdrawal > 0 || wallet.bank?.hasBank) && (
              <View style={styles.walletMeta}>
                {wallet.pendingWithdrawal > 0 && (
                  <Text style={styles.pendingText}>
                    ₹{formatInr(wallet.pendingWithdrawal)} pending withdrawal
                  </Text>
                )}
                {wallet.bank?.hasBank && (
                  <Text style={styles.bankText}>
                    Bank ••••{wallet.bank.accountLast4} · {wallet.bank.ifsc}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

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
                  <Text style={styles.breakdownJobs}>
                    {item.jobs} job{item.jobs === 1 ? '' : 's'}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width:
                            maxAmount > 0
                              ? `${Math.max(4, (item.amount / maxAmount) * 100)}%`
                              : '4%',
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}

            <Text style={[common.sectionTitle, { fontSize: 16, marginTop: spacing.lg }]}>
              Wallet activity
            </Text>
            {transactions.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No wallet transactions yet</Text>
              </View>
            ) : (
              transactions.map((tx) => {
                const credit = tx.direction === 'credit';
                return (
                  <View key={tx.id} style={[common.card, styles.txRow]}>
                    <View style={styles.txLeft}>
                      <Text style={styles.txTitle}>{TX_LABELS[tx.type] || tx.type}</Text>
                      <Text style={styles.txDate}>{formatDateTime(tx.createdAt)}</Text>
                      {!!tx.note && <Text style={styles.txNote} numberOfLines={1}>{tx.note}</Text>}
                    </View>
                    <Text style={[styles.txAmount, credit ? styles.txCredit : styles.txDebit]}>
                      {credit ? '+' : '−'}₹{formatInr(tx.amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={withdrawOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !withdrawing && setWithdrawOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Withdraw to bank</Text>
            {wallet?.bank?.hasBank && (
              <Text style={styles.modalBank}>
                {wallet.bank.holderName} · ••••{wallet.bank.accountLast4} · {wallet.bank.ifsc}
              </Text>
            )}
            <Text style={styles.modalHint}>
              Available ₹{formatInr(wallet?.availableBalance)}. Admin will transfer after approval.
            </Text>
            <TextInput
              style={styles.amountInput}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="number-pad"
              placeholder="Amount"
              placeholderTextColor={colors.muted}
              editable={!withdrawing}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setWithdrawOpen(false)}
                disabled={withdrawing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, withdrawing && { opacity: 0.6 }]}
                onPress={submitWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <ActivityIndicator color={colors.black} />
                ) : (
                  <Text style={styles.modalConfirmText}>Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  walletCard: {
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  walletLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray,
  },
  walletValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.black,
    marginTop: 2,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.yellow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  withdrawBtnText: {
    fontWeight: '800',
    color: colors.black,
    fontSize: 14,
  },
  walletMeta: {
    marginTop: spacing.sm,
    gap: 2,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  bankText: {
    fontSize: 12,
    color: colors.gray,
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
  txRow: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  txLeft: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
  },
  txDate: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  txNote: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  txCredit: {
    color: colors.success,
  },
  txDebit: {
    color: colors.black,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.black,
  },
  modalBank: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.gray,
  },
  modalHint: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 18,
    fontWeight: '700',
    color: colors.black,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancel: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  modalCancelText: {
    fontWeight: '700',
    color: colors.gray,
  },
  modalConfirm: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.yellow,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontWeight: '800',
    color: colors.black,
  },
});

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  createJoiningFeeOrder,
  getJoiningFee,
  needsJoiningDeposit,
  verifyJoiningFeeOrder,
  type JoiningFeeQuote,
} from '../../lib/api';
import {
  NativeSdkUnavailableError,
  PaymentCancelledError,
  payWithRazorpay,
} from '../../lib/payments';
import GradientButton from '../../components/GradientButton';
import { colors, spacing, radius, common } from '../../constants/theme';

function formatInr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function JoiningDepositScreen() {
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<JoiningFeeQuote | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getJoiningFee();
      setQuote(data);
      if (data.cleared || data.status === 'paid' || data.status === 'waived') {
        router.replace('/(tabs)/home');
        return;
      }
      if (data.expert && !needsJoiningDeposit(data.expert) && data.expert.kycStatus !== 'verified') {
        router.replace('/onboarding');
        return;
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load joining fee.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startPayment() {
    setPaying(true);
    setError(null);
    try {
      const order = await createJoiningFeeOrder();
      if (order.waived || (order.expert && !needsJoiningDeposit(order.expert))) {
        router.replace('/(tabs)/home');
        return;
      }
      if (!order.orderId || !order.keyId) {
        setError('Could not start payment. Try again.');
        return;
      }

      const result = await payWithRazorpay(order);
      const verified = await verifyJoiningFeeOrder(result);
      if (verified.cleared) {
        router.replace('/(tabs)/home');
        return;
      }
      setError('Payment received but not confirmed yet. Pull to refresh or try again.');
    } catch (err: unknown) {
      if (err instanceof PaymentCancelledError) {
        setError(null);
        return;
      }
      if (err instanceof NativeSdkUnavailableError) {
        Alert.alert('Update required', err.message);
        setError(err.message);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Payment failed.';
      setError(msg);
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[common.screen, common.center]} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.yellow} />
      </SafeAreaView>
    );
  }

  const lines = quote?.lines || [];
  const materials = quote?.materials || [];
  const total = quote?.totalAmount ?? quote?.amount ?? 0;

  return (
    <SafeAreaView style={common.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={28} color={colors.black} />
        </View>
        <Text style={styles.title}>Joining deposit</Text>
        <Text style={styles.sub}>
          Your KYC is approved. Pay joining deposit in-app to go online and start receiving
          jobs.
        </Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Amount due</Text>
          <Text style={styles.totalValue}>{formatInr(total)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Category breakdown</Text>
        {lines.map((line) => (
          <View key={line.slug} style={styles.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{line.name}</Text>
              {line.joiningFee <= 0 ? (
                <Text style={styles.lineMeta}>No deposit for this category</Text>
              ) : null}
            </View>
            <Text style={styles.lineFee}>
              {line.joiningFee > 0 ? formatInr(line.joiningFee) : 'Free'}
            </Text>
          </View>
        ))}

        {materials.length > 0 ? (
          <View style={styles.materialsBox}>
            <View style={styles.materialsHeader}>
              <Ionicons name="construct-outline" size={20} color={colors.black} />
              <Text style={styles.materialsTitle}>Chemicals & tools we provide</Text>
            </View>
            {materials.map((m) => (
              <View key={m.slug} style={styles.materialItem}>
                <Text style={styles.materialCat}>{m.name}</Text>
                <Text style={styles.materialNote}>
                  {m.providedMaterialsNote ||
                    'Fasty24 provides cleaning chemicals and tools for jobs in this category.'}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <GradientButton
          title={paying ? 'Processing…' : `Pay ${formatInr(total)}`}
          onPress={startPayment}
          loading={paying}
          disabled={paying || total <= 0}
          style={{ marginTop: spacing.lg }}
        />
        <Text style={styles.hint}>
          Payment opens in the Razorpay sheet inside the app — same as customer booking checkout.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.black,
  },
  sub: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray,
  },
  totalCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  totalLabel: {
    color: colors.darkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    marginTop: 4,
    color: colors.yellow,
    fontSize: 32,
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 14,
    fontWeight: '800',
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.black,
  },
  lineMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  lineFee: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.black,
  },
  materialsBox: {
    marginTop: spacing.lg,
    backgroundColor: '#FFF8E1',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  materialsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  materialsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.black,
    flex: 1,
  },
  materialItem: {
    marginTop: spacing.sm,
  },
  materialCat: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
  },
  materialNote: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 19,
    color: colors.gray,
  },
  error: {
    marginTop: spacing.md,
    color: colors.error,
    fontWeight: '600',
    fontSize: 13,
  },
  hint: {
    marginTop: spacing.md,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
});

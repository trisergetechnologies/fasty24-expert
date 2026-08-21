import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiError,
  Estimate,
  createEstimatePaymentLink,
  getEstimatePaymentStatus,
  markEstimateCash,
} from '../lib/api';
import { colors, common, radius, spacing } from '../constants/theme';

const POLL_MS = 3000;

interface Props {
  visible: boolean;
  estimate: Estimate | null;
  onClose: () => void;
  onPaid: (estimate?: Estimate) => void;
}

export default function PaymentSheet({ visible, estimate, onClose, onPaid }: Props) {
  const [mode, setMode] = useState<'choose' | 'qr'>('choose');
  const [qr, setQr] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cashBusy, setCashBusy] = useState(false);
  const paidRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setMode('choose');
      setQr(null);
      setShortUrl(null);
      paidRef.current = false;
    }
  }, [visible]);

  const showQr = useCallback(async () => {
    if (!estimate) return;
    setLoading(true);
    try {
      const link = await createEstimatePaymentLink(estimate.id);
      setQr(link.qrDataUrl);
      setShortUrl(link.shortUrl);
      setMode('qr');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create the payment link.';
      Alert.alert('Online payment unavailable', `${msg}\n\nYou can still collect cash.`);
    } finally {
      setLoading(false);
    }
  }, [estimate]);

  // Poll while the QR is on screen; the webhook usually lands first but this
  // keeps the expert unblocked if it is delayed.
  useEffect(() => {
    if (!visible || mode !== 'qr' || !estimate) return undefined;
    const timer = setInterval(async () => {
      try {
        const status = await getEstimatePaymentStatus(estimate.id);
        if (status.settled && !paidRef.current) {
          paidRef.current = true;
          clearInterval(timer);
          onPaid();
        }
      } catch {
        // transient network errors are fine, next tick retries
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [visible, mode, estimate, onPaid]);

  async function collectCash() {
    if (!estimate) return;
    setCashBusy(true);
    try {
      const updated = await markEstimateCash(estimate.id);
      paidRef.current = true;
      onPaid(updated);
    } catch (err) {
      Alert.alert('Failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setCashBusy(false);
    }
  }

  function confirmCash() {
    Alert.alert(
      'Confirm cash payment',
      `Confirm that you have received ₹${estimate?.pricing.total} in cash from the customer.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Received', onPress: collectCash },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={common.between}>
            <Text style={styles.title}>Collect payment</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.black} />
            </TouchableOpacity>
          </View>

          <Text style={styles.amount}>₹{estimate?.pricing.total ?? 0}</Text>
          <Text style={styles.caption}>{estimate?.estimateNo}</Text>

          {mode === 'qr' ? (
            <View style={styles.qrArea}>
              {qr ? (
                <>
                  <Image source={{ uri: qr }} style={styles.qr} />
                  <Text style={styles.qrHint}>
                    Ask the customer to scan with any UPI app. This screen updates automatically
                    once the payment lands.
                  </Text>
                  {!!shortUrl && <Text style={styles.link}>{shortUrl}</Text>}
                </>
              ) : (
                <ActivityIndicator color={colors.yellow} />
              )}
              <View style={styles.waitingRow}>
                <ActivityIndicator size="small" color={colors.gray} />
                <Text style={styles.waitingText}>Waiting for payment…</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.optionBtn}
              onPress={showQr}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.black} />
              ) : (
                <>
                  <Ionicons name="qr-code" size={22} color={colors.black} />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Show QR to customer</Text>
                    <Text style={styles.optionSub}>UPI, card, netbanking</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.optionBtn, styles.cashBtn]}
            onPress={confirmCash}
            disabled={cashBusy}
          >
            {cashBusy ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <>
                <Ionicons name="cash-outline" size={22} color={colors.black} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Collected in cash</Text>
                  <Text style={styles.optionSub}>Mark this estimate as settled</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.black },
  amount: { fontSize: 36, fontWeight: '800', color: colors.black, marginTop: spacing.md },
  caption: { fontSize: 13, color: colors.gray, marginBottom: spacing.lg },
  qrArea: { alignItems: 'center', marginBottom: spacing.lg },
  qr: { width: 220, height: 220, borderRadius: radius.md },
  qrHint: {
    textAlign: 'center',
    color: colors.gray,
    fontSize: 13,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  link: { fontSize: 11, color: colors.muted, marginTop: spacing.sm },
  waitingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  waitingText: { color: colors.gray, marginLeft: 8, fontWeight: '600' },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cashBtn: { marginTop: 0 },
  optionText: { marginLeft: spacing.md },
  optionTitle: { fontSize: 15, fontWeight: '800', color: colors.black },
  optionSub: { fontSize: 12, color: colors.gray, marginTop: 2 },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  getBooking,
  markEnRoute,
  markArrived,
  startJob,
  completeJob,
  suggestAddon,
  listAvailableAddons,
  uploadImage,
  listBookingEstimates,
  addLineProof,
  requestBookingCall,
} from '../../lib/api';
import type { BookingDetail, AvailableAddon, Estimate } from '../../lib/api';
import { normalizeBookingDetail, mergeBookingDetail, formatInr, formatDateTime } from '../../lib/booking';
import { subscribeBooking, subscribeBookingEvents } from '../../lib/socket';
import { pauseForegroundJobTracking, startJobLocationTracking, stopJobLocationTracking } from '../../lib/jobTracking';
import { pickImage } from '../../lib/pickImage';
import StatusBadge from '../../components/StatusBadge';
import OtpModal from '../../components/OtpModal';
import JobTimer from '../../components/JobTimer';
import JobCompleteModal from '../../components/JobCompleteModal';
import GradientButton from '../../components/GradientButton';
import EstimateCard from '../../components/EstimateCard';
import PaymentSheet from '../../components/PaymentSheet';
import { colors, spacing, radius, shadows, common, gradients } from '../../constants/theme';

const EN_ROUTE_STATUSES = new Set(['pending', 'confirmed', 'dispatched']);
const ARRIVAL_STATUSES = new Set(['travelling']);

function formatDurationLabel(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [otpMode, setOtpMode] = useState<'start' | 'complete' | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [addonModalVisible, setAddonModalVisible] = useState(false);
  const [addons, setAddons] = useState<AvailableAddon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [localStartedAt, setLocalStartedAt] = useState<string | null>(null);
  const [completionInfo, setCompletionInfo] = useState<{ earning: number; durationLabel: string | null } | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [proofBusyLineId, setProofBusyLineId] = useState<string | null>(null);
  const [payingEstimate, setPayingEstimate] = useState<Estimate | null>(null);
  const [calling, setCalling] = useState(false);
  const startedAtRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const raw = await getBooking(id);
      setBooking(normalizeBookingDetail(raw as any));
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load this job.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadEstimates = useCallback(async () => {
    if (!id) return;
    try {
      setEstimates(await listBookingEstimates(id));
    } catch {
      // estimates are optional context; the job screen still works without them
    }
  }, [id]);

  useEffect(() => {
    load();
    loadEstimates();
  }, [load, loadEstimates]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeBooking(id, (patch) => {
      setBooking((prev) => mergeBookingDetail(prev, patch as any));
    });
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    return subscribeBookingEvents(
      id,
      ['estimate:approved', 'estimate:rejected', 'estimate:paid', 'estimate:updated'],
      () => loadEstimates(),
    );
  }, [id, loadEstimates]);

  // Keep the best-known job start time so the timer can start the instant the job
  // begins, even if the backend response is briefly missing `jobTimer.startedAt`.
  const effectiveStartedAt =
    booking?.jobTimer?.startedAt || booking?.timeline?.startedAt || localStartedAt || null;

  useEffect(() => {
    if (effectiveStartedAt) startedAtRef.current = effectiveStartedAt;
  }, [effectiveStartedAt]);

  useEffect(() => {
    if (!id || !booking) return undefined;
    const raw = booking.backendStatus || '';
    const shouldTrack =
      raw === 'assigned' ||
      raw === 'travelling' ||
      booking.status === 'confirmed' ||
      booking.status === 'travelling' ||
      booking.status === 'dispatched';
    if (!shouldTrack) {
      void stopJobLocationTracking();
      return undefined;
    }
    void startJobLocationTracking(id);
    return () => {
      void pauseForegroundJobTracking();
    };
  }, [id, booking?.status, booking?.backendStatus]);

  async function handleMarkEnRoute() {
    if (!id) return;
    setActionLoading(true);
    try {
      const raw = await markEnRoute(id);
      setBooking(normalizeBookingDetail(raw as any));
    } catch (err: any) {
      Alert.alert('Could not update status', err?.message ?? 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkArrived() {
    if (!id) return;
    setActionLoading(true);
    try {
      const picked = await pickImage({ mode: 'camera', cameraType: 'front' });
      if (!('uri' in picked)) {
        return;
      }
      const uploaded = await uploadImage(picked.uri);
      const raw = await markArrived(id, uploaded.url);
      setBooking(normalizeBookingDetail(raw as any));
    } catch (err: any) {
      Alert.alert('Could not mark arrived', err?.message ?? 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOtpSubmit(otp: string) {
    if (!id || !otpMode) return;
    const mode = otpMode;
    setActionLoading(true);
    setOtpError(null);
    try {
      const raw = mode === 'start' ? await startJob(id, otp) : await completeJob(id, otp);
      const updated = normalizeBookingDetail(raw as any);
      setBooking(updated);
      setOtpMode(null);

      if (mode === 'start') {
        // Guarantee the timer starts the moment the job begins, even if the backend
        // hasn't stamped `jobTimer.startedAt` on this response yet.
        if (!updated.jobTimer?.startedAt && !updated.timeline?.startedAt) {
          setLocalStartedAt(new Date().toISOString());
        }
      } else {
        const startedRef = updated.jobTimer?.startedAt || updated.timeline?.startedAt || startedAtRef.current;
        const durationLabel = startedRef
          ? formatDurationLabel(Date.now() - new Date(startedRef).getTime())
          : null;
        setCompletionInfo({ earning: updated.expertEarning, durationLabel });
      }
    } catch (err: any) {
      setOtpError(err?.message ?? 'Please check the code and try again.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleCompletionDone() {
    setCompletionInfo(null);
    router.back();
  }

  async function handleAddProof(estimateId: string, lineId: string) {
    setProofBusyLineId(lineId);
    try {
      const picked = await pickImage({ mode: 'camera' });
      if (!('uri' in picked)) return;
      const uploaded = await uploadImage(picked.uri);
      const updated = await addLineProof(estimateId, lineId, uploaded.url);
      setEstimates((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Please try again.');
    } finally {
      setProofBusyLineId(null);
    }
  }

  function handlePaid(updated?: Estimate) {
    setPayingEstimate(null);
    if (updated) {
      setEstimates((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } else {
      loadEstimates();
    }
  }

  async function openAddonPicker() {
    if (!id) return;
    setAddonModalVisible(true);
    setAddonsLoading(true);
    try {
      const list = await listAvailableAddons(id);
      setAddons(list);
    } catch (err: any) {
      Alert.alert('Could not load add-ons', err?.message ?? 'Please try again.');
      setAddonModalVisible(false);
    } finally {
      setAddonsLoading(false);
    }
  }

  async function handleSuggestAddon(addon: AvailableAddon) {
    if (!id) return;
    try {
      await suggestAddon(id, addon.id);
      setAddonModalVisible(false);
      Alert.alert('Suggested', `"${addon.name}" was suggested to the customer.`);
    } catch (err: any) {
      Alert.alert('Could not suggest add-on', err?.message ?? 'Please try again.');
    }
  }

  async function callCustomer() {
    if (!id || !booking?.canCall || calling) return;
    setCalling(true);
    try {
      const res = await requestBookingCall(id);
      Alert.alert(
        'Calling…',
        res.message || 'Answer your phone — we will connect you to the customer.',
      );
    } catch (err: any) {
      Alert.alert('Could not call', err?.message ?? 'Please try again.');
    } finally {
      setCalling(false);
    }
  }

  function openMaps() {
    if (!booking?.address) return;
    const query = encodeURIComponent(booking.address);
    Linking.openURL(`https://maps.google.com/?q=${query}`);
  }

  if (loading) {
    return (
      <SafeAreaView style={[common.screen, common.center]} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.yellow} />
      </SafeAreaView>
    );
  }

  if (error && !booking) {
    return (
      <SafeAreaView style={[common.screen, common.center]} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!booking) return null;

  const windowStart = booking.scheduledSlot?.windowStart || booking.scheduledFor;
  const scheduledTooEarly =
    booking.bookingType === 'scheduled' &&
    !!windowStart &&
    Date.parse(String(windowStart)) - Date.now() > 30 * 60 * 1000;
  const showEnRoute = EN_ROUTE_STATUSES.has(booking.status) && !scheduledTooEarly;
  const showArrive = ARRIVAL_STATUSES.has(booking.status);
  const showStart = booking.status === 'arrived' && !!booking.arrivalSelfie?.url;
  const showComplete = booking.status === 'in_progress';
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';
  const isArrived = booking.status === 'arrived';
  const canEstimate = isArrived || booking.status === 'in_progress';

  const activeEstimates = estimates.filter(
    (e) => !['cancelled', 'expired', 'rejected'].includes(e.status),
  );
  const approvedEstimates = estimates.filter((e) => e.status === 'approved');
  const unsettledEstimate = approvedEstimates.find((e) => !e.settled) ?? null;
  const proofPending = approvedEstimates.some((e) => !e.proofComplete);

  const primaryActionLabel = showEnRoute
    ? "I'm on the way"
    : showArrive
      ? 'Mark Arrived'
      : showStart
        ? 'Start Job'
        : booking.status === 'arrived'
          ? 'Capture Selfie to Start'
          : 'Complete Job';

  function handlePrimaryAction() {
    if (showEnRoute) handleMarkEnRoute();
    else if (showArrive) handleMarkArrived();
    else if (showStart) setOtpMode('start');
    else if (isArrived) handleMarkArrived();
    else if (showComplete) {
      // The backend rejects completion until estimates are settled and photographed,
      // so surface the remaining step here instead of a failed request.
      if (proofPending) {
        Alert.alert(
          'Photo required',
          'Upload a photo of every installed part before completing the job.',
        );
        return;
      }
      if (unsettledEstimate) {
        setPayingEstimate(unsettledEstimate);
        return;
      }
      setOtpMode('complete');
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" />

      {/* Top bar */}
      <LinearGradient colors={gradients.dark} style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Job Details</Text>
        <StatusBadge status={booking.status} />
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Live job timer — starts the moment the expert starts the job */}
        {showComplete && effectiveStartedAt && (
          <JobTimer startedAt={effectiveStartedAt} durationMin={booking.jobTimer?.durationMin} />
        )}

        {/* Service card */}
        <View style={[common.card, styles.card]}>
          <Text style={styles.serviceName}>{booking.serviceName}</Text>
          <Text style={styles.scheduled}>{formatDateTime(booking.scheduledAt)}</Text>
          {scheduledTooEarly ? (
            <Text style={[styles.scheduled, { color: colors.yellow, marginTop: 6 }]}>
              Starts later — you can head out from 30 minutes before the slot.
            </Text>
          ) : null}

          <View style={styles.divider} />

          <TouchableOpacity style={styles.rowBetween} onPress={openMaps} disabled={!booking.address}>
            <View style={styles.rowStart}>
              <Ionicons name="location-outline" size={18} color={colors.gray} />
              <Text style={styles.rowText} numberOfLines={2}>{booking.address || 'No address provided'}</Text>
            </View>
            {!!booking.address && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
          </TouchableOpacity>
        </View>

        {/* Customer card */}
        <View style={[common.card, styles.card]}>
          <Text style={common.sectionSub}>Customer</Text>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.customerName}>{booking.customerName}</Text>
              <Text style={styles.customerPhone}>
                {booking.canCall ? 'Call via Fasty24 (number hidden)' : 'Calling unavailable'}
              </Text>
            </View>
            {booking.canCall ? (
              <TouchableOpacity
                style={[styles.callBtn, calling && { opacity: 0.6 }]}
                onPress={callCustomer}
                disabled={calling}
              >
                {calling ? (
                  <ActivityIndicator size="small" color={colors.black} />
                ) : (
                  <Ionicons name="call" size={18} color={colors.black} />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Payment card */}
        <View style={[common.card, styles.card]}>
          <Text style={common.sectionSub}>Payment</Text>
          <View style={[common.between, styles.amountRow]}>
            <Text style={styles.rowText}>Total amount</Text>
            <Text style={styles.amountValue}>₹{formatInr(booking.totalAmount)}</Text>
          </View>
          <View style={[common.between, styles.amountRow]}>
            <Text style={styles.rowText}>Your earning</Text>
            <Text style={[styles.amountValue, styles.amountHighlight]}>
              ₹{formatInr(booking.expertEarning)}
            </Text>
          </View>
          <View style={[common.between, styles.amountRow]}>
            <Text style={styles.rowText}>Payment method</Text>
            <Text style={styles.rowValue}>{booking.paymentMethod}</Text>
          </View>

          {booking.addOns.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={[common.sectionSub, { marginBottom: spacing.xs }]}>Add-ons</Text>
              {booking.addOns.map((addon) => (
                <View key={addon.serviceId} style={[common.between, styles.amountRow]}>
                  <Text style={styles.rowText}>{addon.name}</Text>
                  <Text style={styles.rowValue}>₹{formatInr(addon.amount)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Estimates for parts / repairs found on site */}
        {(canEstimate || activeEstimates.length > 0) && (
          <View style={styles.estimateSection}>
            <View style={[common.between, styles.estimateHeader]}>
              <Text style={styles.estimateTitle}>Estimates</Text>
              {canEstimate && (
                <TouchableOpacity
                  onPress={() => router.push(`/estimate/${id}`)}
                  hitSlop={10}
                  style={styles.newEstimateBtn}
                >
                  <Ionicons name="add" size={16} color={colors.black} />
                  <Text style={styles.newEstimateText}>New</Text>
                </TouchableOpacity>
              )}
            </View>

            {activeEstimates.length === 0 ? (
              <View style={[common.card, styles.card]}>
                <Text style={styles.estimateEmpty}>
                  Found a part that needs replacing? Create an estimate and send it to the
                  customer for approval.
                </Text>
              </View>
            ) : (
              activeEstimates.map((estimate) => (
                <EstimateCard
                  key={estimate.id}
                  estimate={estimate}
                  busyLineId={proofBusyLineId}
                  onEdit={() =>
                    router.push(`/estimate/${id}?estimateId=${estimate.id}`)
                  }
                  onAddProof={(lineId) => handleAddProof(estimate.id, lineId)}
                  onCollect={() => setPayingEstimate(estimate)}
                />
              ))
            )}
          </View>
        )}

        {!!booking.notes && (
          <View style={[common.card, styles.card]}>
            <Text style={common.sectionSub}>Notes</Text>
            <Text style={styles.rowText}>{booking.notes}</Text>
          </View>
        )}

        {isCancelled && (
          <View style={[styles.card, styles.cancelledBanner]}>
            <Ionicons name="close-circle" size={20} color={colors.error} />
            <Text style={styles.cancelledText}>This job was cancelled.</Text>
          </View>
        )}

        {isCompleted && (
          <View style={[styles.card, styles.completedBanner]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.completedText}>Job completed. Great work!</Text>
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Action bar */}
      {(showEnRoute || showArrive || showStart || showComplete || booking.status === 'arrived') && (
        <View style={styles.actionBar}>
          {showComplete && (
            <TouchableOpacity
              style={styles.addonBtn}
              onPress={openAddonPicker}
              disabled={actionLoading}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.black} />
              <Text style={styles.addonBtnText}>Suggest Add-on</Text>
            </TouchableOpacity>
          )}
          <GradientButton
            title={primaryActionLabel}
            onPress={handlePrimaryAction}
            loading={actionLoading}
            disabled={actionLoading}
            style={styles.primaryAction}
          />
        </View>
      )}

      <OtpModal
        visible={otpMode !== null}
        title={otpMode === 'start' ? 'Start Job' : 'Complete Job'}
        subtitle={
          otpMode === 'start'
            ? 'Ask the customer for the start code shown on their app.'
            : 'Ask the customer for the completion code shown on their app.'
        }
        confirmLabel={otpMode === 'start' ? 'Start' : 'Complete'}
        loading={actionLoading}
        error={otpError}
        onClose={() => {
          setOtpMode(null);
          setOtpError(null);
        }}
        onSubmit={handleOtpSubmit}
      />

      <PaymentSheet
        visible={payingEstimate !== null}
        estimate={payingEstimate}
        onClose={() => setPayingEstimate(null)}
        onPaid={handlePaid}
      />

      <JobCompleteModal
        visible={completionInfo !== null}
        earning={completionInfo?.earning ?? booking.expertEarning}
        durationLabel={completionInfo?.durationLabel ?? null}
        customerName={booking.customerName}
        onDone={handleCompletionDone}
      />

      <Modal
        visible={addonModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddonModalVisible(false)}
      >
        <View style={styles.addonBackdrop}>
          <View style={styles.addonSheet}>
            <View style={common.between}>
              <Text style={styles.addonTitle}>Suggest an Add-on</Text>
              <TouchableOpacity onPress={() => setAddonModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.gray} />
              </TouchableOpacity>
            </View>
            {addonsLoading ? (
              <ActivityIndicator color={colors.yellow} style={{ marginVertical: spacing.lg }} />
            ) : addons.length === 0 ? (
              <Text style={styles.rowText}>No add-ons available for this booking.</Text>
            ) : (
              <FlatList
                data={addons}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.addonRow}
                    onPress={() => handleSuggestAddon(item)}
                  >
                    <View>
                      <Text style={styles.addonName}>{item.name}</Text>
                      <Text style={styles.addonMeta}>{item.durationMin} min</Text>
                    </View>
                    <Text style={styles.addonPrice}>₹{formatInr(item.price)}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.light,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  topBarTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.black,
  },
  scheduled: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowText: {
    fontSize: 14,
    color: colors.black,
    flexShrink: 1,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.black,
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRow: {
    marginBottom: spacing.xs,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.black,
  },
  amountHighlight: {
    color: colors.success,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEE2E2',
  },
  cancelledText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 14,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#D1FAE5',
  },
  completedText: {
    color: '#065F46',
    fontWeight: '700',
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
    marginBottom: spacing.sm,
  },
  retryBtnText: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 14,
  },
  backLink: {
    padding: spacing.sm,
  },
  backLinkText: {
    color: colors.gray,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Math.max(spacing.md, 20),
  },
  primaryAction: {
    flex: 1,
  },
  disabled: {
    opacity: 0.6,
  },
  addonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.black,
  },
  addonBtnText: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.black,
  },
  estimateSection: {
    marginBottom: spacing.xs,
  },
  estimateHeader: {
    marginBottom: spacing.sm,
  },
  estimateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.black,
  },
  newEstimateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.yellow,
  },
  newEstimateText: {
    fontWeight: '800',
    fontSize: 13,
    color: colors.black,
  },
  estimateEmpty: {
    fontSize: 14,
    color: colors.gray,
    lineHeight: 20,
  },
  addonBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  addonSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  addonTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.black,
    marginBottom: spacing.md,
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addonName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.black,
  },
  addonMeta: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  addonPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.black,
  },
});

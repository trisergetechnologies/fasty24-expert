import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../../components/GradientButton';
import { pickImage } from '../../lib/pickImage';
import PartPicker from '../../components/PartPicker';
import {
  createEstimate,
  getBooking,
  getEstimate,
  sendEstimate,
  updateEstimate,
  uploadImage,
  ApiError,
  EstimateLineInput,
  RateCard,
} from '../../lib/api';
import { colors, common, radius, shadows, spacing } from '../../constants/theme';

interface DraftLine extends EstimateLineInput {
  name: string;
  key: string;
}

const TAX_PERCENT = 18;

export default function EstimateBuilderScreen() {
  const { bookingId, estimateId } = useLocalSearchParams<{
    bookingId: string;
    estimateId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [category, setCategory] = useState<string | undefined>();
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [rateCard, setRateCard] = useState<RateCard | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [notes, setNotes] = useState('');
  const [diagnosisImages, setDiagnosisImages] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string | null>(estimateId ?? null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const booking = await getBooking(bookingId);
      setServiceId(booking.serviceId || undefined);
      setCategory(booking.categorySlugs?.[0] || booking.serviceSlug || undefined);
      setRateCard(booking.rateCard || null);

      if (estimateId) {
        const existing = await getEstimate(estimateId);
        setNotes(existing.diagnosisNotes);
        setDiagnosisImages(existing.diagnosisImages);
        setLines(
          existing.lines.map((l, i) => ({
            key: `${l.id}-${i}`,
            partId: l.partId,
            name: l.name,
            sku: l.sku,
            brand: l.sku || undefined,
            source: l.sku && !l.partId ? 'rate_card' : l.partId ? 'catalog' : 'custom',
            unit: l.unit,
            kind: l.kind,
            imageUrl: l.imageUrl,
            qty: l.qty,
            unitPrice: l.unitPrice,
          })),
        );
        setDraftId(existing.id);
      }
    } catch (err) {
      Alert.alert('Could not load', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, estimateId]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.qty, 0);
    const tax = Math.round(subtotal * (TAX_PERCENT / 100));
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  function addLine(line: EstimateLineInput & { name: string }) {
    setLines((prev) => {
      const existing = prev.findIndex((l) => {
        if (l.partId && line.partId && l.partId === line.partId) return true;
        if (line.source === 'rate_card' && l.source === 'rate_card' && l.name === line.name && (l.brand || '') === (line.brand || '')) {
          return true;
        }
        return false;
      });
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], qty: next[existing].qty + 1 };
        return next;
      }
      return [...prev, { ...line, key: `${line.partId ?? line.name}-${Date.now()}` }];
    });
  }

  function changeQty(key: string, delta: number) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.key !== key) return [l];
        const qty = l.qty + delta;
        return qty <= 0 ? [] : [{ ...l, qty }];
      }),
    );
  }

  async function addDiagnosisPhoto() {
    const picked = await pickImage({ mode: 'camera' });
    if (!('uri' in picked)) return;
    setUploading(true);
    try {
      const uploaded = await uploadImage(picked.uri);
      setDiagnosisImages((prev) => [...prev, uploaded.url]);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function toPayload() {
    return {
      lines: lines.map((l) => ({
        partId: l.partId ?? undefined,
        name: l.name,
        sku: l.sku,
        brand: l.brand || l.sku,
        unit: l.unit,
        kind: l.kind,
        imageUrl: l.imageUrl,
        qty: l.qty,
        unitPrice: l.unitPrice,
        source: l.source,
      })),
      diagnosisNotes: notes,
      diagnosisImages,
    };
  }

  async function persist() {
    if (!bookingId) return null;
    const payload = toPayload();
    if (draftId) {
      const updated = await updateEstimate(draftId, payload);
      return updated.id;
    }
    const created = await createEstimate(bookingId, payload);
    setDraftId(created.id);
    return created.id;
  }

  async function handleSaveDraft() {
    if (!lines.length) return;
    setSaving(true);
    try {
      await persist();
      Alert.alert('Draft saved', 'You can send this estimate to the customer any time.');
      router.back();
    } catch (err) {
      Alert.alert('Save failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!lines.length) return;
    setSaving(true);
    try {
      const id = await persist();
      if (!id) return;
      await sendEstimate(id);
      Alert.alert(
        'Estimate sent',
        'The customer has been notified. You will be alerted once they respond.',
      );
      router.back();
    } catch (err) {
      Alert.alert('Send failed', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={common.screen}>
        <View style={common.center}>
          <ActivityIndicator color={colors.yellow} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={common.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create estimate</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={common.card}>
          <Text style={styles.cardTitle}>What did you find?</Text>
          <TextInput
            style={[common.input, styles.notes]}
            placeholder="e.g. RO membrane choked, sediment filter fully clogged"
            placeholderTextColor={colors.muted}
            multiline
            value={notes}
            onChangeText={setNotes}
          />
          <View style={styles.photoRow}>
            {diagnosisImages.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.diagPhoto} />
            ))}
            <TouchableOpacity
              style={styles.addPhoto}
              onPress={addDiagnosisPhoto}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={colors.gray} size="small" />
              ) : (
                <Ionicons name="camera-outline" size={22} color={colors.gray} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[common.card, styles.section]}>
          <View style={common.between}>
            <Text style={styles.cardTitle}>Parts & labour</Text>
            <TouchableOpacity onPress={() => setPickerOpen(true)} hitSlop={10}>
              <Text style={styles.addLink}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.payoutHint}>
            Prefer the published rate card so the customer can accept the same prices they already saw.
          </Text>

          {lines.length === 0 ? (
            <Text style={styles.emptyLines}>
              No items yet. Add from the rate card, then send it to the customer for approval.
            </Text>
          ) : (
            lines.map((line) => (
              <View key={line.key} style={styles.lineRow}>
                <View style={styles.lineInfo}>
                  <Text style={styles.lineName} numberOfLines={1}>
                    {line.name}
                  </Text>
                  <Text style={styles.lineMeta}>
                    ₹{line.unitPrice} · {line.source === 'rate_card' ? 'Rate card' : line.kind === 'labour' ? 'Labour' : 'Part'}
                    {line.brand ? ` · ${line.brand}` : ''}
                    {line.partId || line.source === 'rate_card' ? '' : ' · custom'}
                  </Text>
                </View>
                <View style={styles.qtyBox}>
                  <TouchableOpacity onPress={() => changeQty(line.key, -1)} hitSlop={8}>
                    <Ionicons name="remove-circle-outline" size={24} color={colors.gray} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{line.qty}</Text>
                  <TouchableOpacity onPress={() => changeQty(line.key, 1)} hitSlop={8}>
                    <Ionicons name="add-circle" size={24} color={colors.yellow} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.lineTotal}>₹{(line.unitPrice ?? 0) * line.qty}</Text>
              </View>
            ))
          )}
        </View>

        {lines.length > 0 && (
          <View style={[common.card, styles.section]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>₹{totals.subtotal}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST ({TAX_PERCENT}%)</Text>
              <Text style={styles.totalValue}>₹{totals.tax}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={styles.grandValue}>₹{totals.total}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[common.btnOutline, styles.draftBtn, !lines.length && styles.disabled]}
          disabled={!lines.length || saving}
          onPress={handleSaveDraft}
        >
          <Text style={common.btnOutlineText}>Save draft</Text>
        </TouchableOpacity>
        <GradientButton
          title="Send to customer"
          onPress={handleSend}
          loading={saving}
          disabled={!lines.length}
          style={styles.sendBtn}
        />
      </View>

      <PartPicker
        visible={pickerOpen}
        category={category}
        serviceId={serviceId}
        rateCard={rateCard}
        onClose={() => setPickerOpen(false)}
        onSelect={addLine}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.black },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  section: { marginTop: spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.black, marginBottom: spacing.sm },
  payoutHint: { color: colors.gray, fontSize: 12, marginBottom: spacing.sm, marginTop: -4 },
  notes: { height: 90, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  diagPhoto: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLink: { color: colors.black, fontWeight: '800', fontSize: 15 },
  emptyLines: { color: colors.gray, fontSize: 14, paddingVertical: spacing.sm },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 15, fontWeight: '700', color: colors.black },
  lineMeta: { fontSize: 12, color: colors.gray, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.sm },
  qtyText: { minWidth: 28, textAlign: 'center', fontWeight: '800', color: colors.black },
  lineTotal: { minWidth: 64, textAlign: 'right', fontWeight: '800', color: colors.black },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { color: colors.gray, fontSize: 14 },
  totalValue: { color: colors.black, fontSize: 14, fontWeight: '600' },
  grandRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  grandLabel: { fontSize: 16, fontWeight: '800', color: colors.black },
  grandValue: { fontSize: 20, fontWeight: '800', color: colors.black },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.card,
  },
  draftBtn: { flex: 1, marginRight: spacing.sm },
  sendBtn: { flex: 1.4 },
  disabled: { opacity: 0.5 },
});

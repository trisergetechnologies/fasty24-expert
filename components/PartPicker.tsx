import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listParts, Part, EstimateLineInput, RateCard, rateCardBrands } from '../lib/api';
import { colors, common, radius, spacing } from '../constants/theme';

interface Props {
  visible: boolean;
  category?: string;
  serviceId?: string;
  rateCard?: RateCard | null;
  onClose: () => void;
  onSelect: (line: EstimateLineInput & { name: string }) => void;
}

export default function PartPicker({ visible, category, serviceId, rateCard, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customKind, setCustomKind] = useState<'part' | 'labour'>('part');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setParts(await listParts({ category, serviceId }));
    } catch {
      setParts([]);
    } finally {
      setLoading(false);
    }
  }, [category, serviceId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q),
    );
  }, [parts, query]);

  const rateGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rateCardBrands(rateCard)
      .map((brand) => ({
        name: brand.name,
        items: brand.items.filter(
          (item) =>
            !q ||
            item.name.toLowerCase().includes(q) ||
            brand.name.toLowerCase().includes(q) ||
            (item.notes || '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [rateCard, query]);

  function reset() {
    setQuery('');
    setCustomOpen(false);
    setCustomName('');
    setCustomPrice('');
    setCustomKind('part');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickRateCard(brand: string, item: { name: string; price: number; notes: string }) {
    onSelect({
      name: item.name,
      brand,
      sku: brand,
      kind: 'part',
      unitPrice: item.price,
      qty: 1,
      source: 'rate_card',
    });
    handleClose();
  }

  function pickCatalog(part: Part) {
    onSelect({
      partId: part.id,
      name: part.name,
      sku: part.sku,
      unit: part.unit,
      kind: part.kind === 'labour' ? 'labour' : 'part',
      imageUrl: part.imageUrl,
      unitPrice: part.price,
      qty: 1,
    });
    handleClose();
  }

  function addCustom() {
    const name = customName.trim();
    const price = Number(customPrice);
    if (!name || !Number.isFinite(price) || price < 0) return;
    onSelect({ name, kind: customKind, unitPrice: Math.round(price), qty: 1, source: 'custom' });
    handleClose();
  }

  const canAddCustom = customName.trim().length > 0 && Number(customPrice) >= 0 && customPrice !== '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={common.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add item</Text>
          <View style={{ width: 26 }} />
        </View>

        {customOpen ? (
          <View style={styles.customForm}>
            <Text style={styles.customTitle}>Custom item</Text>
            <Text style={styles.customHint}>
              Our team will verify this part and its price before it appears in the catalog.
            </Text>

            <View style={styles.kindRow}>
              {(['part', 'labour'] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kindChip, customKind === k && styles.kindChipActive]}
                  onPress={() => setCustomKind(k)}
                >
                  <Text style={[styles.kindChipText, customKind === k && styles.kindChipTextActive]}>
                    {k === 'part' ? 'Part' : 'Labour'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[common.input, styles.field]}
              placeholder="Item name"
              placeholderTextColor={colors.muted}
              value={customName}
              onChangeText={setCustomName}
            />
            <TextInput
              style={[common.input, styles.field]}
              placeholder="Price (₹)"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={customPrice}
              onChangeText={setCustomPrice}
            />

            <TouchableOpacity
              style={[common.btnPrimary, !canAddCustom && styles.disabled]}
              disabled={!canAddCustom}
              onPress={addCustom}
            >
              <Text style={common.btnPrimaryText}>Add to estimate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backLink} onPress={() => setCustomOpen(false)}>
              <Text style={styles.backLinkText}>Back to catalog</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search rate card or catalog"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
              />
            </View>

            {loading && rateGroups.length === 0 ? (
              <View style={common.center}>
                <ActivityIndicator color={colors.yellow} />
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                  rateGroups.length ? (
                    <View style={styles.rateWrap}>
                      <Text style={styles.sectionLabel}>
                        {rateCard?.title || 'Rate card'}
                      </Text>
                      <Text style={styles.sectionHint}>Published prices — customer sees these before approving</Text>
                      {rateGroups.map((brand) => (
                        <View key={brand.name || 'brand'} style={styles.brandBlock}>
                          {!!brand.name && <Text style={styles.brandTitle}>{brand.name}</Text>}
                          {brand.items.map((item) => (
                            <TouchableOpacity
                              key={`${brand.name}-${item.name}`}
                              style={styles.partRow}
                              onPress={() => pickRateCard(brand.name, item)}
                            >
                              <View style={[styles.thumb, styles.thumbFallback]}>
                                <Ionicons name="pricetag-outline" size={20} color={colors.muted} />
                              </View>
                              <View style={styles.partInfo}>
                                <Text style={styles.partName} numberOfLines={1}>
                                  {item.name}
                                </Text>
                                <Text style={styles.partMeta} numberOfLines={1}>
                                  {[brand.name, item.notes].filter(Boolean).join(' · ') || 'Rate card'}
                                </Text>
                              </View>
                              <Text style={styles.partPrice}>₹{item.price}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ))}
                      {filtered.length > 0 ? (
                        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Catalog</Text>
                      ) : null}
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  loading ? null : (
                    <Text style={styles.empty}>
                      {rateGroups.length
                        ? 'No extra catalog parts. Pick from the rate card above or add a custom item.'
                        : 'No parts found. Use "Add custom item" below.'}
                    </Text>
                  )
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.partRow} onPress={() => pickCatalog(item)}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbFallback]}>
                        <Ionicons name="cube-outline" size={22} color={colors.muted} />
                      </View>
                    )}
                    <View style={styles.partInfo}>
                      <Text style={styles.partName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.partMeta} numberOfLines={1}>
                        {[item.brand, item.kind === 'kit' ? 'Kit' : null, `per ${item.unit}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.partPrice}>₹{item.price}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <View style={styles.footer}>
              <TouchableOpacity style={common.btnOutline} onPress={() => setCustomOpen(true)}>
                <Text style={common.btnOutlineText}>Add custom item</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.black },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    margin: spacing.md,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 15, color: colors.black },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.sm,
  },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.light },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  partInfo: { flex: 1, marginHorizontal: 12 },
  partName: { fontSize: 15, fontWeight: '700', color: colors.black },
  partMeta: { fontSize: 12, color: colors.gray, marginTop: 2 },
  partPrice: { fontSize: 15, fontWeight: '800', color: colors.black },
  empty: { textAlign: 'center', color: colors.gray, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  rateWrap: { marginBottom: spacing.sm },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.black,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  sectionHint: { fontSize: 12, color: colors.gray, marginBottom: spacing.sm },
  brandBlock: { marginBottom: spacing.sm },
  brandTitle: { fontSize: 15, fontWeight: '800', color: colors.black, marginBottom: 8, marginTop: 4 },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  customForm: { padding: spacing.md },
  customTitle: { fontSize: 18, fontWeight: '800', color: colors.black },
  customHint: { fontSize: 13, color: colors.gray, marginTop: 4, marginBottom: spacing.md },
  kindRow: { flexDirection: 'row', marginBottom: spacing.md },
  kindChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.white,
  },
  kindChipActive: { borderColor: colors.yellow, backgroundColor: colors.yellow },
  kindChipText: { fontWeight: '700', color: colors.gray },
  kindChipTextActive: { color: colors.black },
  field: { marginBottom: spacing.md },
  disabled: { opacity: 0.5 },
  backLink: { alignItems: 'center', paddingVertical: spacing.md },
  backLinkText: { color: colors.gray, fontWeight: '600' },
});

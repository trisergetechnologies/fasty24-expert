import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Estimate, EstimateStatus } from '../lib/api';
import { colors, common, radius, spacing } from '../constants/theme';

const STATUS_META: Record<EstimateStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', fg: colors.gray },
  sent: { label: 'Awaiting customer', bg: '#FEF3C7', fg: '#92400E' },
  approved: { label: 'Approved', bg: '#D1FAE5', fg: '#065F46' },
  rejected: { label: 'Declined', bg: '#FEE2E2', fg: '#991B1B' },
  expired: { label: 'Expired', bg: '#F3F4F6', fg: colors.gray },
  cancelled: { label: 'Withdrawn', bg: '#F3F4F6', fg: colors.gray },
};

interface Props {
  estimate: Estimate;
  onEdit?: () => void;
  onAddProof?: (lineId: string) => void;
  onCollect?: () => void;
  busyLineId?: string | null;
}

export default function EstimateCard({
  estimate,
  onEdit,
  onAddProof,
  onCollect,
  busyLineId,
}: Props) {
  const meta = STATUS_META[estimate.status];
  const isApproved = estimate.status === 'approved';
  const partLines = estimate.lines.filter((l) => l.kind === 'part');
  const missingProof = partLines.filter((l) => l.proofImages.length === 0).length;

  return (
    <View style={[common.card, styles.card]}>
      <View style={common.between}>
        <View>
          <Text style={styles.title}>{estimate.estimateNo || 'Estimate'}</Text>
          <Text style={styles.subtitle}>
            {estimate.lines.length} item{estimate.lines.length === 1 ? '' : 's'} · ₹
            {estimate.pricing.total}
          </Text>
        </View>
        <View style={[common.badge, { backgroundColor: meta.bg }]}>
          <Text style={[common.badgeText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
      </View>

      {estimate.status === 'rejected' && !!estimate.rejectReason && (
        <Text style={styles.reason}>"{estimate.rejectReason}"</Text>
      )}

      {estimate.lines.map((line) => {
        const needsProof = isApproved && line.kind === 'part' && line.proofImages.length === 0;
        return (
          <View key={line.id} style={styles.lineRow}>
            <View style={styles.lineInfo}>
              <Text style={styles.lineName} numberOfLines={1}>
                {line.qty} × {line.name}
              </Text>
              <Text style={styles.lineMeta}>₹{line.lineTotal}</Text>
            </View>

            {isApproved && line.kind === 'part' && (
              <View style={styles.proofArea}>
                {line.proofImages.slice(0, 2).map((p) => (
                  <Image key={p.url} source={{ uri: p.url }} style={styles.proofThumb} />
                ))}
                {onAddProof && (
                  <TouchableOpacity
                    style={[styles.proofBtn, needsProof && styles.proofBtnRequired]}
                    onPress={() => onAddProof(line.id)}
                    disabled={busyLineId === line.id}
                  >
                    <Ionicons
                      name="camera"
                      size={16}
                      color={needsProof ? colors.error : colors.gray}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      {isApproved && missingProof > 0 && (
        <View style={styles.warnRow}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.warnText}>
            Photo needed for {missingProof} installed part{missingProof === 1 ? '' : 's'}
          </Text>
        </View>
      )}

      {isApproved && (
        <View style={styles.payRow}>
          {estimate.settled ? (
            <View style={styles.paidPill}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.paidText}>
                Paid {estimate.payment.method === 'cash' ? 'in cash' : 'online'}
              </Text>
            </View>
          ) : (
            onCollect && (
              <TouchableOpacity style={styles.collectBtn} onPress={onCollect}>
                <Ionicons name="qr-code-outline" size={18} color={colors.black} />
                <Text style={styles.collectText}>Collect ₹{estimate.pricing.total}</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      )}

      {estimate.status === 'draft' && onEdit && (
        <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
          <Text style={styles.editText}>Edit & send</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { fontSize: 16, fontWeight: '800', color: colors.black },
  subtitle: { fontSize: 13, color: colors.gray, marginTop: 2 },
  reason: { fontStyle: 'italic', color: colors.gray, marginTop: spacing.sm, fontSize: 13 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 14, fontWeight: '600', color: colors.black },
  lineMeta: { fontSize: 12, color: colors.gray, marginTop: 2 },
  proofArea: { flexDirection: 'row', alignItems: 'center' },
  proofThumb: { width: 32, height: 32, borderRadius: radius.sm, marginRight: 6 },
  proofBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofBtnRequired: { borderColor: colors.error, borderWidth: 2 },
  warnRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  warnText: { color: colors.error, fontSize: 12, marginLeft: 6, fontWeight: '600' },
  payRow: { marginTop: spacing.md },
  paidPill: { flexDirection: 'row', alignItems: 'center' },
  paidText: { color: colors.success, fontWeight: '700', marginLeft: 6 },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.yellow,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  collectText: { fontWeight: '800', color: colors.black, marginLeft: 8 },
  editBtn: { marginTop: spacing.md, alignItems: 'center', paddingVertical: 10 },
  editText: { color: colors.black, fontWeight: '700' },
});

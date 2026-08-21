import { View, Text } from 'react-native';
import { common } from '../constants/theme';
import type { BookingStatus } from '../lib/api';

const STATUS_MAP: Record<BookingStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: '#FEF3C7', text: '#92400E' },
  confirmed: { label: 'Assigned', bg: '#DBEAFE', text: '#1E40AF' },
  dispatched: { label: 'Dispatched', bg: '#EDE9FE', text: '#5B21B6' },
  travelling: { label: 'On the way', bg: '#FEF9C3', text: '#713F12' },
  arrived: { label: 'Arrived', bg: '#FEF3C7', text: '#B45309' },
  in_progress: { label: 'In Progress', bg: '#FFF7ED', text: '#C2410C' },
  completed: { label: 'Completed', bg: '#D1FAE5', text: '#065F46' },
  cancelled: { label: 'Cancelled', bg: '#FEE2E2', text: '#991B1B' },
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const cfg = STATUS_MAP[status] ?? { label: status, bg: '#F3F4F6', text: '#374151' };
  return (
    <View style={[common.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[common.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

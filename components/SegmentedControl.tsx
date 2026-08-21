import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../constants/theme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.black,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray,
  },
  labelActive: {
    color: colors.yellow,
  },
});

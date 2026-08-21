import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import GradientButton from './GradientButton';
import { colors, spacing, radius, shadows } from '../constants/theme';

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (otp: string) => void;
}

const OTP_LENGTH = 4;

export default function OtpModal({
  visible,
  title,
  subtitle,
  confirmLabel = 'Confirm',
  loading = false,
  onClose,
  onSubmit,
}: Props) {
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (visible) setOtp('');
  }, [visible]);

  const canSubmit = otp.trim().length === OTP_LENGTH && !loading;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            placeholder={'•'.repeat(OTP_LENGTH)}
            placeholderTextColor={colors.muted}
            autoFocus
            textAlign="center"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <GradientButton
              title={confirmLabel}
              onPress={() => onSubmit(otp.trim())}
              disabled={!canSubmit}
              loading={loading}
              style={styles.confirmBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.dark,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.black,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 12,
    color: colors.black,
    backgroundColor: colors.light,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  cancelText: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.gray,
  },
  confirmBtn: {
    flex: 1,
  },
});

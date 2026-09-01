import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { requestOtp, verifyOtp } from '../lib/api';
import { setToken, setUser } from '../lib/storage';
import { connectSocket } from '../lib/socket';
import { registerForPushNotifications } from '../lib/push';
import { resumeOfferSession } from '../lib/offerBridge';
import { PARTNER_PRIVACY_URL, PARTNER_TERMS_URL } from '../lib/legal';
import GradientButton from '../components/GradientButton';
import { colors, spacing, radius, shadows, common, gradients } from '../constants/theme';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const otpRef = useRef<TextInput>(null);

  async function handleSendOtp() {
    if (phone.trim().length < 10) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(phone.trim());
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.trim().length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP sent to your phone.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(phone.trim(), otp.trim());
      await setToken(res.token);
      const expert = res.expert ?? res.principal;
      if (expert) await setUser(expert);
      await connectSocket();
      registerForPushNotifications();
      resumeOfferSession();
      if (res.needsOnboarding || expert?.kycStatus !== 'verified') {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo block */}
        <View style={styles.logoBlock}>
          <LinearGradient colors={gradients.primary} style={styles.badge}>
            <Text style={styles.badgeText}>F</Text>
          </LinearGradient>
          <Text style={styles.appName}>Fasty24</Text>
          <Text style={styles.appSub}>Expert Portal</Text>
        </View>

        <View style={styles.card}>
          {step === 'phone' ? (
            <>
              <Text style={styles.heading}>Welcome back</Text>
              <Text style={styles.sub}>Enter your registered phone number</Text>
              <TextInput
                style={[common.input, styles.input]}
                placeholder="Phone number"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
                autoFocus
              />
              <GradientButton title="Send OTP" onPress={handleSendOtp} loading={loading} />
            </>
          ) : (
            <>
              <Text style={styles.heading}>Verify OTP</Text>
              <Text style={styles.sub}>Enter the code sent to {phone}</Text>
              <TextInput
                ref={otpRef}
                style={[common.input, styles.input, styles.otpInput]}
                placeholder="6-digit OTP"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
              />
              <GradientButton title="Verify & Continue" onPress={handleVerifyOtp} loading={loading} />
              <TouchableOpacity
                style={styles.resend}
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                }}
              >
                <Text style={styles.resendText}>Change number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.legal}>
          By continuing, you agree to our{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(PARTNER_TERMS_URL)}>
            Partner Terms
          </Text>
          {' '}and{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(PARTNER_PRIVACY_URL)}>
            Privacy Policy
          </Text>
          .
        </Text>

        <Text style={styles.footer}>
          For service professionals only.{'\n'}Download the customer app to book services.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badgeText: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.black,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 1,
  },
  appSub: {
    fontSize: 13,
    color: colors.yellow,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.dark,
  },
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.black,
    marginBottom: spacing.xs,
  },
  sub: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  resend: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resendText: {
    color: colors.gray,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  legal: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  legalLink: {
    color: colors.yellow,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

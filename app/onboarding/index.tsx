import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMe, submitOnboarding, updateMe, uploadImage, getCatalog } from '../../lib/api';
import { pickImage } from '../../lib/pickImage';
import ImageSourceSheet from '../../components/ImageSourceSheet';
import TradePicker, { EMAIL_RE, GENDER_OPTIONS, inferEnrolledFromSkills } from '../../components/TradePicker';
import type { CatalogCategory, Expert, ExpertGender } from '../../lib/api';
import GradientButton from '../../components/GradientButton';
import { colors, spacing, radius, shadows, common } from '../../constants/theme';

type Step = 'welcome' | 0 | 1 | 2 | 3 | 4;

const STEPS = ['Aadhaar', 'PAN', 'Selfie', 'Bank', 'Skills'] as const;

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [expert, setExpert] = useState<Expert | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<ExpertGender>('');
  const [email, setEmail] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState('');
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panUrl, setPanUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountConfirm, setAccountConfirm] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState('');
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [enrolled, setEnrolled] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [sourcePrompt, setSourcePrompt] = useState<{ field: string; title: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setExpert(me);
        if (me.kycStatus === 'verified') {
          router.replace('/(tabs)/home');
          return;
        }
        if (me.name && me.name !== 'New Expert') setFullName(me.name);
        if (me.gender) setGender(me.gender);
        if (me.email) setEmail(me.email);
        if (me.documents) {
          setAadhaarNumber(me.documents.aadhaarNumber || '');
          setAadhaarFrontUrl(me.documents.aadhaarFrontUrl || '');
          setAadhaarBackUrl(me.documents.aadhaarBackUrl || '');
          setPanNumber(me.documents.panNumber || '');
          setPanUrl(me.documents.panUrl || '');
          setSelfieUrl(me.documents.selfieUrl || '');
        }
        if (me.bank) {
          setAccountNumber(me.bank.accountNumber || '');
          setAccountConfirm(me.bank.accountNumber || '');
          setIfsc(me.bank.ifsc || '');
          setHolderName(me.bank.holderName || '');
        }
        try {
          const cats = await getCatalog();
          setCatalog(cats);
          if (me.enrolledCategories?.length) {
            setEnrolled(me.enrolledCategories);
            setExcluded(me.excludedServiceIds || []);
          } else if (me.skills?.length) {
            setEnrolled(inferEnrolledFromSkills(cats, me.skills));
          }
        } catch {
          setCatalog([]);
        }
      } catch {
        router.replace('/login');
      } finally {
        setCatalogLoading(false);
        setLoading(false);
      }
    })();
  }, []);

  async function pickAndUpload(
    field: string,
    mode: 'camera' | 'library',
    cameraType: 'front' | 'back' = 'back',
  ) {
    const picked = await pickImage({ mode, cameraType });
    if (!('uri' in picked)) return;

    setUploading(field);
    setFieldError(null);
    try {
      const uploaded = await uploadImage(picked.uri);
      if (field === 'aadhaarFront') setAadhaarFrontUrl(uploaded.url);
      if (field === 'aadhaarBack') setAadhaarBackUrl(uploaded.url);
      if (field === 'pan') setPanUrl(uploaded.url);
      if (field === 'selfie') setSelfieUrl(uploaded.url);
    } catch (err: any) {
      setFieldError(err?.message ?? 'Could not upload image.');
    } finally {
      setUploading(null);
    }
  }

  function validateStep(): boolean {
    setFieldError(null);
    if (step === 'welcome') {
      if (fullName.trim().length < 2) {
        setFieldError('Enter your full name as on Aadhaar.');
        return false;
      }
      if (!gender) {
        setFieldError('Select your gender.');
        return false;
      }
      if (!EMAIL_RE.test(email.trim())) {
        setFieldError('Enter a valid email address.');
        return false;
      }
    }
    if (step === 0) {
      if (aadhaarNumber.replace(/\s/g, '').length !== 12) {
        setFieldError('Enter a valid 12-digit Aadhaar number.');
        return false;
      }
      if (!aadhaarFrontUrl || !aadhaarBackUrl) {
        setFieldError('Upload both front and back of your Aadhaar card.');
        return false;
      }
    }
    if (step === 1) {
      if (!PAN_RE.test(panNumber.trim())) {
        setFieldError('Enter a valid PAN (e.g. ABCDE1234F).');
        return false;
      }
      if (!panUrl) {
        setFieldError('Upload a photo of your PAN card.');
        return false;
      }
    }
    if (step === 2 && !selfieUrl) {
      setFieldError('Capture a live selfie to continue. Keep your face in the frame.');
      return false;
    }
    if (step === 3) {
      if (!holderName.trim()) {
        setFieldError('Enter the account holder name.');
        return false;
      }
      if (accountNumber.trim().length < 8) {
        setFieldError('Enter a valid bank account number.');
        return false;
      }
      if (accountNumber.trim() !== accountConfirm.trim()) {
        setFieldError('Account numbers do not match.');
        return false;
      }
      if (!IFSC_RE.test(ifsc.trim())) {
        setFieldError('Enter a valid IFSC (e.g. HDFC0001234).');
        return false;
      }
    }
    if (step === 4 && enrolled.length === 0) {
      setFieldError('Select at least one category so we can send you matching jobs.');
      return false;
    }
    return true;
  }

  async function next() {
    if (!validateStep()) return;
    if (step === 'welcome') {
      try {
        await updateMe({ name: fullName.trim(), email: email.trim(), gender });
      } catch {
        // draft save is best-effort; submit still sends the name
      }
      setStep(0);
      return;
    }
    if (step < 4) setStep((s) => ((s as number) + 1) as Step);
    else handleSubmit();
  }

  function back() {
    setFieldError(null);
    if (step === 0) {
      setStep('welcome');
      return;
    }
    if (typeof step === 'number' && step > 0) setStep((s) => ((s as number) - 1) as Step);
  }

  async function handleSubmit() {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      const updated = await submitOnboarding({
        name: fullName.trim(),
        email: email.trim(),
        gender,
        specialization: enrolled[0] || 'general',
        enrolledCategories: enrolled,
        excludedServiceIds: excluded,
        documents: {
          aadhaarNumber: aadhaarNumber.replace(/\s/g, ''),
          aadhaarFrontUrl,
          aadhaarBackUrl,
          panNumber: panNumber.trim().toUpperCase(),
          panUrl,
          selfieUrl,
        },
        bank: {
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          holderName: holderName.trim(),
        },
      });
      setExpert(updated);
    } catch (err: any) {
      setFieldError(err?.message ?? 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
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

  if (expert?.kycStatus === 'submitted') {
    return (
      <SafeAreaView style={[common.screen, common.center]} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <Ionicons name="time-outline" size={56} color={colors.yellow} />
        <Text style={styles.waitTitle}>Application under review</Text>
        <Text style={styles.waitSub}>
          Thanks {fullName.split(' ')[0] || 'partner'}. An admin will verify your documents.
          You can go online only after approval — we will notify you.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={common.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {step === 'welcome' ? (
        <ScrollView contentContainerStyle={styles.welcomeBody} keyboardShouldPersistTaps="handled">
          <View style={styles.welcomeBadge}>
            <Ionicons name="shield-checkmark" size={28} color={colors.black} />
          </View>
          <Text style={styles.welcomeTitle}>Become a Fasty24 partner</Text>
          <Text style={styles.welcomeSub}>
            We verify every expert so customers can trust you. KYC takes about 5 minutes.
            After you submit, an admin reviews your documents — then you can go online and
            start taking jobs.
          </Text>
          <Text style={styles.label}>Your full name</Text>
          <TextInput
            style={common.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Name as on Aadhaar"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
          <Text style={[styles.label, { marginTop: spacing.md }]}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDER_OPTIONS.map((opt) => {
              const on = gender === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setGender(opt.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.label, { marginTop: spacing.md }]}>Email</Text>
          <TextInput
            style={common.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!fieldError && <Text style={styles.inlineError}>{fieldError}</Text>}
          <View style={styles.welcomePoints}>
            <WelcomePoint text="Aadhaar, PAN, live selfie, and bank details" />
            <WelcomePoint text="Pick the skills you actually do" />
            <WelcomePoint text="Wait for approval — no home access until then" />
          </View>
          <GradientButton title="Start KYC" onPress={next} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Partner onboarding</Text>
            <Text style={styles.sub}>
              {typeof step === 'number' ? `${STEPS[step]} · ${step + 1} of ${STEPS.length}` : ''}
            </Text>
            <View style={styles.progressRow}>
              {STEPS.map((label, i) => (
                <View key={label} style={[styles.dot, typeof step === 'number' && i <= step && styles.dotActive]} />
              ))}
            </View>
            {expert?.kycStatus === 'rejected' && (
              <View style={styles.rejectBanner}>
                <Text style={styles.rejectText}>
                  Rejected{expert.kycNote ? `: ${expert.kycNote}` : '.'} Please correct and resubmit.
                </Text>
              </View>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {step === 0 && (
              <View style={[common.card, styles.card]}>
                <Text style={styles.label}>Aadhaar number</Text>
                <TextInput
                  style={common.input}
                  value={aadhaarNumber}
                  onChangeText={setAadhaarNumber}
                  keyboardType="number-pad"
                  maxLength={12}
                  placeholder="12-digit Aadhaar"
                  placeholderTextColor={colors.muted}
                />
                <DocSlot
                  label="Aadhaar Front"
                  url={aadhaarFrontUrl}
                  loading={uploading === 'aadhaarFront'}
                  onPress={() => setSourcePrompt({ field: 'aadhaarFront', title: 'Aadhaar Front' })}
                />
                <DocSlot
                  label="Aadhaar Back"
                  url={aadhaarBackUrl}
                  loading={uploading === 'aadhaarBack'}
                  onPress={() => setSourcePrompt({ field: 'aadhaarBack', title: 'Aadhaar Back' })}
                />
              </View>
            )}

            {step === 1 && (
              <View style={[common.card, styles.card]}>
                <Text style={styles.label}>PAN number</Text>
                <TextInput
                  style={common.input}
                  value={panNumber}
                  onChangeText={setPanNumber}
                  autoCapitalize="characters"
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  placeholderTextColor={colors.muted}
                />
                <DocSlot
                  label="PAN Card Photo"
                  url={panUrl}
                  loading={uploading === 'pan'}
                  onPress={() => setSourcePrompt({ field: 'pan', title: 'PAN Card' })}
                />
              </View>
            )}

            {step === 2 && (
              <View style={[common.card, styles.card]}>
                <Text style={styles.label}>Live selfie</Text>
                <Text style={styles.hint}>
                  Center your face in the frame. Some Android phones open the rear camera — flip to
                  front if needed. Gallery upload is not allowed.
                </Text>
                <DocSlot
                  label={selfieUrl ? 'Retake selfie' : 'Capture selfie'}
                  url={selfieUrl}
                  loading={uploading === 'selfie'}
                  onPress={() => pickAndUpload('selfie', 'camera', 'front')}
                />
              </View>
            )}

            {step === 3 && (
              <View style={[common.card, styles.card]}>
                <Text style={styles.label}>Account holder name</Text>
                <TextInput
                  style={common.input}
                  value={holderName}
                  onChangeText={setHolderName}
                  placeholder="Name as per bank"
                  placeholderTextColor={colors.muted}
                />
                <Text style={[styles.label, { marginTop: spacing.md }]}>Account number</Text>
                <TextInput
                  style={common.input}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="number-pad"
                  placeholder="Bank account number"
                  placeholderTextColor={colors.muted}
                />
                <Text style={[styles.label, { marginTop: spacing.md }]}>Confirm account number</Text>
                <TextInput
                  style={common.input}
                  value={accountConfirm}
                  onChangeText={setAccountConfirm}
                  keyboardType="number-pad"
                  placeholder="Re-enter account number"
                  placeholderTextColor={colors.muted}
                />
                <Text style={[styles.label, { marginTop: spacing.md }]}>IFSC</Text>
                <TextInput
                  style={common.input}
                  value={ifsc}
                  onChangeText={setIfsc}
                  autoCapitalize="characters"
                  placeholder="e.g. HDFC0001234"
                  placeholderTextColor={colors.muted}
                />
              </View>
            )}

            {step === 4 && (
              <View style={[common.card, styles.card]}>
                <Text style={styles.label}>What work do you take?</Text>
                <Text style={styles.hint}>
                  Tick every trade you do. Expand a category to turn off a service you do not offer.
                  New services in a selected trade are sent to you automatically.
                </Text>
                <TradePicker
                  categories={catalog}
                  enrolled={enrolled}
                  excluded={excluded}
                  onChange={(nextEnrolled, nextExcluded) => {
                    setEnrolled(nextEnrolled);
                    setExcluded(nextExcluded);
                  }}
                  loading={catalogLoading}
                />
              </View>
            )}

            {!!fieldError && <Text style={styles.inlineError}>{fieldError}</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.backBtn} onPress={back} disabled={submitting}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <GradientButton
              title={step === 4 ? 'Submit application' : 'Continue'}
              onPress={next}
              loading={submitting || !!uploading}
              disabled={submitting || !!uploading}
              style={styles.nextBtn}
            />
          </View>
        </>
      )}

      <ImageSourceSheet
        visible={!!sourcePrompt}
        title={sourcePrompt?.title || 'Add photo'}
        onClose={() => setSourcePrompt(null)}
        onCamera={() => {
          const field = sourcePrompt?.field;
          setSourcePrompt(null);
          if (field) void pickAndUpload(field, 'camera', 'back');
        }}
        onLibrary={() => {
          const field = sourcePrompt?.field;
          setSourcePrompt(null);
          if (field) void pickAndUpload(field, 'library');
        }}
      />
    </SafeAreaView>
  );
}

function WelcomePoint({ text }: { text: string }) {
  return (
    <View style={styles.pointRow}>
      <Ionicons name="checkmark-circle" size={18} color={colors.yellow} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

function DocSlot({
  label,
  url,
  loading,
  onPress,
}: {
  label: string;
  url: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.docSlot} onPress={onPress} disabled={loading}>
      {url ? (
        <Image source={{ uri: url }} style={styles.docImage} />
      ) : (
        <View style={styles.docEmpty}>
          {loading ? (
            <ActivityIndicator color={colors.yellow} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={28} color={colors.gray} />
              <Text style={styles.docEmptyText}>{label}</Text>
            </>
          )}
        </View>
      )}
      {!!url && <Text style={styles.docCaption}>{label} ✓ — tap to retake</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.black,
  },
  sub: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.yellow,
  },
  rejectBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  rejectText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  welcomeBody: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  welcomeBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.black,
    marginBottom: spacing.sm,
  },
  welcomeSub: {
    fontSize: 14,
    color: colors.gray,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  welcomePoints: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    color: colors.black,
    fontWeight: '600',
  },
  card: {
    ...shadows.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  inlineError: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  chipOn: {
    borderColor: colors.black,
    backgroundColor: colors.yellow,
  },
  chipText: {
    fontWeight: '700',
    color: colors.gray,
  },
  chipTextOn: {
    color: colors.black,
  },
  docSlot: {
    marginTop: spacing.md,
  },
  docImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.light,
  },
  docEmpty: {
    height: 140,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.light,
  },
  docEmptyText: {
    color: colors.gray,
    fontWeight: '600',
  },
  docCaption: {
    marginTop: 6,
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  backBtn: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  backBtnText: {
    fontWeight: '700',
    color: colors.gray,
  },
  nextBtn: {
    flex: 1,
  },
  waitTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.black,
    marginTop: spacing.md,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  waitSub: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
});

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getMe, submitOnboarding, uploadImage } from '../../lib/api';
import type { Expert } from '../../lib/api';
import GradientButton from '../../components/GradientButton';
import { colors, spacing, radius, shadows, common } from '../../constants/theme';

type Step = 0 | 1 | 2 | 3 | 4;

const STEPS = ['Aadhaar', 'PAN', 'Selfie', 'Bank', 'Specialization'] as const;

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [expert, setExpert] = useState<Expert | null>(null);

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState('');
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panUrl, setPanUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState('');
  const [specialization, setSpecialization] = useState('general');

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setExpert(me);
        if (me.kycStatus === 'verified') {
          router.replace('/(tabs)/home');
          return;
        }
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
          setIfsc(me.bank.ifsc || '');
          setHolderName(me.bank.holderName || '');
        }
        if (me.specialization) setSpecialization(me.specialization);
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function pickAndUpload(
    field: string,
    mode: 'camera' | 'library',
    cameraType: 'front' | 'back' = 'back',
  ) {
    const permission =
      mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera/photo access to continue.');
      return;
    }

    const result =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            cameraType:
              cameraType === 'front'
                ? ImagePicker.CameraType.front
                : ImagePicker.CameraType.back,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: false,
          });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploading(field);
    try {
      const uploaded = await uploadImage(result.assets[0].uri);
      if (field === 'aadhaarFront') setAadhaarFrontUrl(uploaded.url);
      if (field === 'aadhaarBack') setAadhaarBackUrl(uploaded.url);
      if (field === 'pan') setPanUrl(uploaded.url);
      if (field === 'selfie') setSelfieUrl(uploaded.url);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload image.');
    } finally {
      setUploading(null);
    }
  }

  function promptDocUpload(field: string, title: string) {
    Alert.alert(title, 'Choose how to add the document', [
      { text: 'Take Photo', onPress: () => pickAndUpload(field, 'camera', 'back') },
      { text: 'Choose from Gallery', onPress: () => pickAndUpload(field, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function validateStep(): boolean {
    if (step === 0) {
      if (aadhaarNumber.replace(/\s/g, '').length !== 12) {
        Alert.alert('Invalid Aadhaar', 'Enter a valid 12-digit Aadhaar number.');
        return false;
      }
      if (!aadhaarFrontUrl || !aadhaarBackUrl) {
        Alert.alert('Documents required', 'Upload both front and back of your Aadhaar card.');
        return false;
      }
    }
    if (step === 1) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(panNumber.trim())) {
        Alert.alert('Invalid PAN', 'Enter a valid PAN number (e.g. ABCDE1234F).');
        return false;
      }
      if (!panUrl) {
        Alert.alert('Document required', 'Upload a photo of your PAN card.');
        return false;
      }
    }
    if (step === 2 && !selfieUrl) {
      Alert.alert('Selfie required', 'Capture a live selfie to continue.');
      return false;
    }
    if (step === 3) {
      if (!accountNumber.trim() || !ifsc.trim() || !holderName.trim()) {
        Alert.alert('Bank details required', 'Fill account number, IFSC, and holder name.');
        return false;
      }
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    if (step < 4) setStep((s) => (s + 1) as Step);
    else handleSubmit();
  }

  async function handleSubmit() {
    if (!validateStep()) return;
    setSubmitting(true);
    try {
      await submitOnboarding({
        specialization: specialization || 'general',
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
      Alert.alert(
        'Submitted',
        'Your application was sent for admin review. You can go online after approval.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }],
      );
    } catch (err: any) {
      Alert.alert('Could not submit', err?.message ?? 'Please try again.');
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
        <Ionicons name="time-outline" size={48} color={colors.yellow} />
        <Text style={styles.waitTitle}>Under review</Text>
        <Text style={styles.waitSub}>
          Your documents were submitted. An admin will approve your account soon.
        </Text>
        <GradientButton title="Go to Home" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: spacing.lg, width: '80%' }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={common.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Expert Onboarding</Text>
        <Text style={styles.sub}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</Text>
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>
        {expert?.kycStatus === 'rejected' && !!expert.kycNote && (
          <View style={styles.rejectBanner}>
            <Text style={styles.rejectText}>Rejected: {expert.kycNote}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View style={[common.card, styles.card]}>
            <Text style={styles.label}>Aadhaar Number</Text>
            <TextInput
              style={common.input}
              value={aadhaarNumber}
              onChangeText={setAadhaarNumber}
              keyboardType="number-pad"
              maxLength={12}
              placeholder="12-digit Aadhaar"
            />
            <DocSlot
              label="Aadhaar Front"
              url={aadhaarFrontUrl}
              loading={uploading === 'aadhaarFront'}
              onPress={() => promptDocUpload('aadhaarFront', 'Aadhaar Front')}
            />
            <DocSlot
              label="Aadhaar Back"
              url={aadhaarBackUrl}
              loading={uploading === 'aadhaarBack'}
              onPress={() => promptDocUpload('aadhaarBack', 'Aadhaar Back')}
            />
          </View>
        )}

        {step === 1 && (
          <View style={[common.card, styles.card]}>
            <Text style={styles.label}>PAN Number</Text>
            <TextInput
              style={common.input}
              value={panNumber}
              onChangeText={setPanNumber}
              autoCapitalize="characters"
              maxLength={10}
              placeholder="ABCDE1234F"
            />
            <DocSlot
              label="PAN Card Photo"
              url={panUrl}
              loading={uploading === 'pan'}
              onPress={() => promptDocUpload('pan', 'PAN Card')}
            />
          </View>
        )}

        {step === 2 && (
          <View style={[common.card, styles.card]}>
            <Text style={styles.label}>Live Selfie</Text>
            <Text style={styles.hint}>Use the front camera. Gallery upload is not allowed for this step.</Text>
            <DocSlot
              label="Selfie"
              url={selfieUrl}
              loading={uploading === 'selfie'}
              onPress={() => pickAndUpload('selfie', 'camera', 'front')}
            />
          </View>
        )}

        {step === 3 && (
          <View style={[common.card, styles.card]}>
            <Text style={styles.label}>Account Holder Name</Text>
            <TextInput style={common.input} value={holderName} onChangeText={setHolderName} placeholder="Name as per bank" />
            <Text style={[styles.label, { marginTop: spacing.md }]}>Account Number</Text>
            <TextInput
              style={common.input}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              placeholder="Bank account number"
            />
            <Text style={[styles.label, { marginTop: spacing.md }]}>IFSC</Text>
            <TextInput
              style={common.input}
              value={ifsc}
              onChangeText={setIfsc}
              autoCapitalize="characters"
              placeholder="e.g. HDFC0001234"
            />
          </View>
        )}

        {step === 4 && (
          <View style={[common.card, styles.card]}>
            <Text style={styles.label}>Specialization</Text>
            <Text style={styles.hint}>
              For now all approved experts receive every service request. You can note a preferred category below.
            </Text>
            <TextInput
              style={common.input}
              value={specialization}
              onChangeText={setSpecialization}
              placeholder="general"
            />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => (s - 1) as Step)} disabled={submitting}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <GradientButton
          title={step === 4 ? 'Submit Application' : 'Continue'}
          onPress={next}
          loading={submitting || !!uploading}
          disabled={submitting || !!uploading}
          style={styles.nextBtn}
        />
      </View>
    </SafeAreaView>
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
    fontSize: 20,
    fontWeight: '900',
    color: colors.black,
    marginTop: spacing.md,
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
  
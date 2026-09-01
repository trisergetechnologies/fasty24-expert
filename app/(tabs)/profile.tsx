import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMe, updateMe, submitTraining, getCatalog } from '../../lib/api';
import type { CatalogCategory, Expert, ExpertGender } from '../../lib/api';
import { clearAll } from '../../lib/storage';
import { disconnectSocket } from '../../lib/socket';
import { DELETE_ACCOUNT_URL, PARTNER_PRIVACY_URL, PARTNER_TERMS_URL } from '../../lib/legal';
import GradientButton from '../../components/GradientButton';
import TradePicker, { EMAIL_RE, GENDER_OPTIONS, inferEnrolledFromSkills } from '../../components/TradePicker';
import { clearAll } from '../../lib/storage';
import { disconnectSocket } from '../../lib/socket';
import { DELETE_ACCOUNT_URL, PARTNER_PRIVACY_URL, PARTNER_TERMS_URL } from '../../lib/legal';
import GradientButton from '../../components/GradientButton';
import { colors, spacing, radius, shadows, common, gradients } from '../../constants/theme';

const KYC_LABELS: Record<Expert['kycStatus'], { label: string; bg: string; text: string }> = {
  pending: { label: 'Not Submitted', bg: '#FEF3C7', text: '#92400E' },
  submitted: { label: 'Under Review', bg: '#DBEAFE', text: '#1E40AF' },
  verified: { label: 'Verified', bg: '#D1FAE5', text: '#065F46' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', text: '#991B1B' },
};

const TRAINING_LABELS: Record<Expert['trainingStatus'], { label: string; bg: string; text: string }> = {
  pending: { label: 'Not Started', bg: '#F3F4F6', text: '#374151' },
  not_started: { label: 'Not Started', bg: '#F3F4F6', text: '#374151' },
  in_progress: { label: 'In Progress', bg: '#FEF3C7', text: '#92400E' },
  completed: { label: 'Completed', bg: '#D1FAE5', text: '#065F46' },
};

export default function ProfileScreen() {
  const [expert, setExpert] = useState<Expert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trainingSubmitting, setTrainingSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<ExpertGender>('');
  const [bio, setBio] = useState('');
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [enrolled, setEnrolled] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);

  function fillForm(e: Expert, cats: CatalogCategory[] = catalog) {
    setName(e.name ?? '');
    setEmail(e.email ?? '');
    setGender(e.gender ?? '');
    setBio(e.bio ?? '');
    if (e.enrolledCategories?.length) {
      setEnrolled(e.enrolledCategories);
      setExcluded(e.excludedServiceIds || []);
    } else {
      setEnrolled(inferEnrolledFromSkills(cats, e.skills ?? []));
      setExcluded([]);
    }
  }

  const load = useCallback(async () => {
    try {
      const [e, cats] = await Promise.all([getMe(), getCatalog().catch(() => [] as CatalogCategory[])]);
      setCatalog(cats);
      setExpert(e);
      fillForm(e, cats);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSave() {
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert('Check email', 'Enter a valid email address.');
      return;
    }
    if (!gender) {
      Alert.alert('Gender required', 'Select your gender.');
      return;
    }
    if (!enrolled.length) {
      Alert.alert('Select your work', 'Choose at least one category so we can send matching jobs.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMe({
        name: name.trim(),
        email: email.trim(),
        gender,
        bio: bio.trim(),
        enrolledCategories: enrolled,
        excludedServiceIds: excluded,
      });
      setExpert(updated);
      fillForm(updated);
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Could not save', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (expert) fillForm(expert);
    setEditing(false);
  }

  async function handleTrainingAction(next: 'in_progress' | 'completed') {
    setTrainingSubmitting(true);
    try {
      await submitTraining(next);
      await load();
    } catch (err: any) {
      Alert.alert('Could not update training', err?.message ?? 'Please try again.');
    } finally {
      setTrainingSubmitting(false);
    }
  }

  function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          disconnectSocket();
          await clearAll();
          router.replace('/login');
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={[common.screen, common.center]} edges={['top']}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.yellow} />
      </SafeAreaView>
    );
  }

  if (error && !expert) {
    return (
      <SafeAreaView style={[common.screen, common.center]} edges={['top']}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!expert) return null;

  const initials = expert.name
    ?.split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const kyc = KYC_LABELS[expert.kycStatus] ?? KYC_LABELS.pending;
  const training = TRAINING_LABELS[expert.trainingStatus] ?? TRAINING_LABELS.pending;

  return (
    <SafeAreaView style={common.screen} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={common.sectionTitle}>Profile</Text>
          {!editing && (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={16} color={colors.black} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.avatarBlock}>
          <LinearGradient colors={gradients.primary} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          {!editing && <Text style={styles.name}>{expert.name}</Text>}
          <Text style={styles.phone}>{expert.phone}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>⭐ {expert.rating?.toFixed(1) ?? '—'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{expert.completedJobs ?? 0}</Text>
            <Text style={styles.statLabel}>Jobs Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{((expert.commissionRate ?? 0) * 100).toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Your Share</Text>
          </View>
        </View>

        {editing ? (
          <View style={[common.card, styles.card]}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={common.input} value={name} onChangeText={setName} placeholder="Your name" />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Email</Text>
            <TextInput
              style={common.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Gender</Text>
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

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Bio</Text>
            <TextInput
              style={[common.input, styles.multiline]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell customers about your experience"
              multiline
              numberOfLines={3}
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Work you take</Text>
            <TradePicker
              categories={catalog}
              enrolled={enrolled}
              excluded={excluded}
              onChange={(nextEnrolled, nextExcluded) => {
                setEnrolled(nextEnrolled);
                setExcluded(nextExcluded);
              }}
            />

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <GradientButton title="Save" onPress={handleSave} loading={saving} style={styles.saveBtn} />
            </View>
          </View>
        ) : (
          <>
            {!!expert.bio && (
              <View style={[common.card, styles.card]}>
                <Text style={common.sectionSub}>Bio</Text>
                <Text style={styles.bioText}>{expert.bio}</Text>
              </View>
            )}

            {!!expert.email && (
              <View style={[common.card, styles.card]}>
                <Text style={common.sectionSub}>Email</Text>
                <Text style={styles.bioText}>{expert.email}</Text>
              </View>
            )}

            {!!expert.gender && (
              <View style={[common.card, styles.card]}>
                <Text style={common.sectionSub}>Gender</Text>
                <Text style={styles.bioText}>
                  {GENDER_OPTIONS.find((g) => g.id === expert.gender)?.label || expert.gender}
                </Text>
              </View>
            )}

            {(expert.enrolledCategories?.length || expert.skills?.length) > 0 && (
              <View style={[common.card, styles.card]}>
                <Text style={[common.sectionSub, { marginBottom: spacing.sm }]}>Work you take</Text>
                <View style={styles.chipRow}>
                  {(expert.enrolledCategories?.length
                    ? expert.enrolledCategories.map(
                        (slug) => catalog.find((c) => c.slug === slug)?.name || slug,
                      )
                    : expert.skills
                  ).map((label) => (
                    <View key={label} style={styles.chip}>
                      <Text style={styles.chipText}>{String(label).replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* KYC */}
        <View style={[common.card, styles.card]}>
          <View style={common.between}>
            <Text style={common.sectionSub}>KYC Verification</Text>
            <View style={[common.badge, { backgroundColor: kyc.bg }]}>
              <Text style={[common.badgeText, { color: kyc.text }]}>{kyc.label}</Text>
            </View>
          </View>
          {(expert.kycStatus === 'pending' || expert.kycStatus === 'rejected') && (
            <GradientButton
              title={expert.kycStatus === 'rejected' ? 'Resubmit Documents' : 'Complete Onboarding'}
              onPress={() => router.push('/onboarding')}
              style={styles.actionBtn}
            />
          )}
          {expert.kycStatus === 'submitted' && (
            <Text style={[styles.kycNote, { color: colors.gray }]}>
              Your application is under admin review.
            </Text>
          )}
          {expert.kycStatus === 'rejected' && !!expert.kycNote && (
            <Text style={styles.kycNote}>{expert.kycNote}</Text>
          )}
        </View>

        {/* Training */}
        <View style={[common.card, styles.card]}>
          <View style={common.between}>
            <Text style={common.sectionSub}>Training</Text>
            <View style={[common.badge, { backgroundColor: training.bg }]}>
              <Text style={[common.badgeText, { color: training.text }]}>{training.label}</Text>
            </View>
          </View>
          {(expert.trainingStatus === 'pending' || expert.trainingStatus === 'not_started') && (
            <GradientButton
              title="Start Training"
              onPress={() => handleTrainingAction('in_progress')}
              loading={trainingSubmitting}
              style={styles.actionBtn}
            />
          )}
          {expert.trainingStatus === 'in_progress' && (
            <GradientButton
              title="Mark Training Complete"
              onPress={() => handleTrainingAction('completed')}
              loading={trainingSubmitting}
              variant="success"
              style={styles.actionBtn}
            />
          )}
        </View>

        <View style={[common.card, styles.card]}>
          <Text style={[common.sectionSub, { marginBottom: spacing.sm }]}>Legal</Text>
          {[
            { label: 'Partner Terms', url: PARTNER_TERMS_URL, icon: 'document-text-outline' as const },
            { label: 'Privacy Policy', url: PARTNER_PRIVACY_URL, icon: 'lock-closed-outline' as const },
            { label: 'Delete account', url: DELETE_ACCOUNT_URL, icon: 'trash-outline' as const },
          ].map((item) => (
            <TouchableOpacity
              key={item.url}
              style={styles.legalRow}
              onPress={() => Linking.openURL(item.url)}
            >
              <Ionicons name={item.icon} size={18} color={colors.black} />
              <Text style={styles.legalRowText}>{item.label}</Text>
              <Ionicons name="open-outline" size={16} color={colors.gray} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
  },
  avatarBlock: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.float,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.black,
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.black,
  },
  phone: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    ...shadows.card,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.black,
  },
  statLabel: {
    fontSize: 10,
    color: colors.gray,
    marginTop: 2,
    fontWeight: '600',
  },
  card: {
    marginBottom: spacing.md,
  },
  bioText: {
    fontSize: 14,
    color: colors.black,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.black,
    textTransform: 'capitalize',
  },
  chipOn: {
    backgroundColor: colors.yellow,
    borderColor: colors.black,
  },
  chipTextOn: {
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.gray,
  },
  saveBtn: {
    flex: 1,
  },
  actionBtn: {
    marginTop: spacing.sm,
  },
  kycNote: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.sm,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legalRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.black,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  logoutText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 15,
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
  },
  retryBtnText: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 14,
  },
});

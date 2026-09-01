import { Modal, View, Text, StyleSheet, BackHandler } from 'react-native';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientButton from './GradientButton';
import { colors, spacing, radius, shadows, gradients } from '../constants/theme';
import type { AppVersionConfig } from '../lib/api';
import { openStore } from '../lib/appVersion';

interface Props {
  visible: boolean;
  config: AppVersionConfig | null;
}

export default function ForceUpdateModal({ visible, config }: Props) {
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  const title = config?.title || 'Update required';
  const message =
    config?.message ||
    'A new version of Fasty24 Expert is available. Please update from the Play Store to continue.';
  const latest = config?.latestVersion ? `Latest version: ${config.latestVersion}` : null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.screen}>
        <View style={styles.card}>
          <LinearGradient colors={gradients.primary} style={styles.iconCircle}>
            <Ionicons name="cloud-download-outline" size={36} color={colors.black} />
          </LinearGradient>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {latest ? <Text style={styles.latest}>{latest}</Text> : null}
          <GradientButton
            title="Update now"
            onPress={() => {
              if (config) void openStore(config);
            }}
            style={styles.button}
          />
          <Text style={styles.footnote}>You need this update to keep using Fasty24 Expert.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.dark,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.black,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray,
    textAlign: 'center',
    fontWeight: '500',
  },
  latest: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
  },
  button: {
    width: '100%',
    marginTop: spacing.lg,
  },
  footnote: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    fontWeight: '600',
  },
});

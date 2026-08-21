import { StyleSheet } from 'react-native';

export const colors = {
  yellow: '#FFC400',
  black: '#0D0D0D',
  white: '#FFFFFF',
  gray: '#6B7280',
  light: '#F9FAFB',
  border: '#E5E7EB',
  muted: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  // Dark-surface tokens (used on black backgrounds: login, offer card, tab bar)
  darkSurface: '#1a1a1a',
  darkSurfaceAlt: '#222222',
  darkBorder: '#333333',
  darkMuted: '#9a9a9a',
  tabInactive: '#7A7A7A',
};

export const gradients = {
  primary: [colors.yellow, '#FFA000'] as const,
  primarySoft: ['#FFE066', colors.yellow] as const,
  dark: ['#242424', colors.black] as const,
  darkDeep: ['#1a1a1a', '#000000'] as const,
  success: ['#34D399', '#059669'] as const,
  overtime: ['#FCA5A5', colors.error] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  float: {
    shadowColor: '#FFC400',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  dark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const common = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.light,
  },
  screenDark: {
    flex: 1,
    backgroundColor: colors.black,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.black,
    marginBottom: spacing.sm,
  },
  sectionSub: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  btnPrimary: {
    backgroundColor: colors.yellow,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center' as const,
    ...shadows.float,
  },
  btnPrimaryText: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.black,
  },
  btnDark: {
    backgroundColor: colors.black,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  btnDarkText: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.yellow,
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  btnOutlineText: {
    fontWeight: '700',
    fontSize: 16,
    color: colors.black,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    color: colors.black,
    backgroundColor: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  between: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  center: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start' as const,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
});

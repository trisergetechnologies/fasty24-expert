import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CatalogCategory } from '../lib/api';
import { colors, spacing, radius } from '../constants/theme';

export const GENDER_OPTIONS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bookableServices(cat: CatalogCategory) {
  return (cat.services || []).filter((s) => s.serviceKind !== 'addon_only');
}

export function inferEnrolledFromSkills(categories: CatalogCategory[], skills: string[]) {
  if (!skills?.length) return [] as string[];
  const set = new Set(skills);
  return categories
    .filter((c) => bookableServices(c).some((s) => set.has(s.skillTag)))
    .map((c) => c.slug);
}

interface Props {
  categories: CatalogCategory[];
  enrolled: string[];
  excluded: string[];
  onChange: (enrolled: string[], excluded: string[]) => void;
  loading?: boolean;
}

export default function TradePicker({ categories, enrolled, excluded, onChange, loading }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.yellow} />
        <Text style={styles.hint}>Loading services…</Text>
      </View>
    );
  }

  if (!categories.length) {
    return <Text style={styles.hint}>No services are available to enroll in right now.</Text>;
  }

  function setEnrollment(nextEnrolled: string[], nextExcluded: string[]) {
    const enrolledSet = new Set(nextEnrolled);
    const allowed = new Set(
      categories
        .filter((c) => enrolledSet.has(c.slug))
        .flatMap((c) => bookableServices(c).map((s) => s.slug)),
    );
    onChange(
      nextEnrolled,
      nextExcluded.filter((slug) => allowed.has(slug)),
    );
  }

  function toggleCategory(cat: CatalogCategory) {
    const on = enrolled.includes(cat.slug);
    if (on) {
      setEnrollment(
        enrolled.filter((s) => s !== cat.slug),
        excluded,
      );
      return;
    }
    const slugs = new Set(bookableServices(cat).map((s) => s.slug));
    setEnrollment(
      [...enrolled, cat.slug],
      excluded.filter((s) => !slugs.has(s)),
    );
  }

  function toggleService(cat: CatalogCategory, serviceSlug: string) {
    const services = bookableServices(cat);
    const catOn = enrolled.includes(cat.slug);
    if (!catOn) {
      const others = services.filter((s) => s.slug !== serviceSlug).map((s) => s.slug);
      setEnrollment([...enrolled, cat.slug], [...excluded, ...others]);
      setOpen((prev) => ({ ...prev, [cat.slug]: true }));
      return;
    }
    const isExcluded = excluded.includes(serviceSlug);
    if (isExcluded) {
      setEnrollment(
        enrolled,
        excluded.filter((s) => s !== serviceSlug),
      );
      return;
    }
    const remaining = services.filter((s) => s.slug !== serviceSlug && !excluded.includes(s.slug));
    if (remaining.length === 0) {
      setEnrollment(
        enrolled.filter((s) => s !== cat.slug),
        excluded,
      );
      return;
    }
    setEnrollment(enrolled, [...excluded, serviceSlug]);
  }

  return (
    <View style={styles.list}>
      {categories.map((cat) => {
        const services = bookableServices(cat);
        const on = enrolled.includes(cat.slug);
        const excludedHere = services.filter((s) => excluded.includes(s.slug)).length;
        const expanded = !!open[cat.slug];
        return (
          <View key={cat.slug} style={[styles.cat, on && styles.catOn]}>
            <View style={styles.catRow}>
              <TouchableOpacity
                style={styles.catMain}
                onPress={() => toggleCategory(cat)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={on ? colors.black : colors.gray}
                />
                <View style={styles.catCopy}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catMeta}>
                    {on
                      ? excludedHere
                        ? `${services.length - excludedHere} of ${services.length} services`
                        : `All ${services.length} services`
                      : `${services.length} services`}
                  </Text>
                </View>
              </TouchableOpacity>
              {services.length > 0 && (
                <TouchableOpacity
                  onPress={() => setOpen((p) => ({ ...p, [cat.slug]: !expanded }))}
                  style={styles.expandBtn}
                  hitSlop={8}
                >
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.gray}
                  />
                </TouchableOpacity>
              )}
            </View>
            {expanded &&
              services.map((svc) => {
                const included = on && !excluded.includes(svc.slug);
                return (
                  <TouchableOpacity
                    key={svc.slug}
                    style={styles.svcRow}
                    onPress={() => toggleService(cat, svc.slug)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={included ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={included ? colors.black : colors.muted}
                    />
                    <Text style={[styles.svcName, included && styles.svcNameOn]}>{svc.name}</Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  hint: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 18,
  },
  list: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cat: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  catOn: {
    borderColor: colors.black,
    backgroundColor: '#FFF8E1',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  catCopy: {
    flex: 1,
  },
  catName: {
    fontWeight: '800',
    fontSize: 15,
    color: colors.black,
  },
  catMeta: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
    fontWeight: '600',
  },
  expandBtn: {
    padding: spacing.sm,
  },
  svcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  svcName: {
    flex: 1,
    fontSize: 13,
    color: colors.gray,
    fontWeight: '600',
  },
  svcNameOn: {
    color: colors.black,
  },
});

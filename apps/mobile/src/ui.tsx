import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DemoVisit, VisitStatus } from './demoData';
import { formatDemoDate, statusLabel } from './demoData';
import { coverageKindLabel, formatDemoTimeRange } from './coverageDemo';
import { palette, corners, spacing, touchSize } from './theme';

export function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <View style={[styles.brandRow]}>
      <View style={[styles.brandIcon, dark && styles.brandIconOnDark]}>
        <Text style={[styles.brandPlus, dark && styles.brandPlusOnDark]}>+</Text>
      </View>
      <View>
        <Text style={[styles.brandTitle, dark && styles.brandTitleOnDark]}>Pediatrics</Text>
        <Text style={[styles.brandCaption, dark && styles.brandCaptionOnDark]}>VISITAS DOMICILIARIAS</Text>
      </View>
    </View>
  );
}

export function DemoBanner({ small = false }: { small?: boolean }) {
  return (
    <View style={[styles.demoBanner, small && styles.demoBannerSmall]} accessibilityRole="text">
      <Text style={styles.demoBannerText}>MODO DEMO · datos ficticios</Text>
    </View>
  );
}

export function StatusChip({ status }: { status: VisitStatus }) {
  const backgroundColor =
    status === 'CLOSED_VERIFIED' ? '#ECFDF3' :
    status === 'IN_PROGRESS' ? '#EFF6FF' : '#F0FDF4';
  const color =
    status === 'CLOSED_VERIFIED' ? '#0F766E' :
    status === 'IN_PROGRESS' ? '#1D4ED8' : palette.primary;
  return (
    <View style={[styles.statusChip, { backgroundColor }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export function VisitCard({
  visit, onPress, selected = false, compact = false,
}: {
  visit: DemoVisit;
  onPress: (id: string) => void;
  selected?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de ${visit.patientLabel}, ${visit.specialty}, ${formatDemoTimeRange(visit.startTime, visit.endTime)}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(visit.id)}
      style={({ pressed }) => [
        styles.visitCard, selected && styles.visitCardSelected,
        pressed && styles.pressed, compact && styles.visitCardCompact,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTimeLine}>
          <View style={styles.calendarDot} />
          <Text style={styles.cardTime}>{formatDemoTimeRange(visit.startTime, visit.endTime)}</Text>
          <Text style={styles.cardDate}>{formatDemoDate(visit.date)}</Text>
        </View>
        <StatusChip status={visit.status} />
      </View>
      <View style={styles.cardMain}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>{visit.patientLabel.slice(-1)}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{visit.patientLabel}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>{visit.specialty}</Text>
          <Text style={styles.cardKind}>{coverageKindLabel(visit.serviceKind)}</Text>
          <Text style={styles.cardLocation} numberOfLines={1}>{visit.neighborhood}</Text>
        </View>
        <Text style={styles.cardChevron} accessibilityElementsHidden>›</Text>
      </View>
    </Pressable>
  );
}

export function ScreenHeading({
  eyebrow, title, subtitle,
}: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.screenHeading}>
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function PrimaryAction({
  label, onPress, outline = false,
}: { label: string; onPress: () => void; outline?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action, outline && styles.outlineAction, pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionLabel, outline && styles.outlineActionLabel]}>{label}</Text>
      <Text style={[styles.actionArrow, outline && styles.outlineActionLabel]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandIcon: {
    backgroundColor: palette.primary, width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  brandIconOnDark: { backgroundColor: palette.mint },
  brandPlus: { color: palette.surface, fontSize: 28, fontWeight: '700', lineHeight: 36 },
  brandPlusOnDark: { color: palette.deep },
  brandTitle: { color: palette.deep, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  brandTitleOnDark: { color: palette.surface },
  brandCaption: { color: palette.textSecondary, fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
  brandCaptionOnDark: { color: palette.brandMuted },
  demoBanner: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: '#FFF7DD', borderColor: '#EBC08E',
    borderWidth: 1, borderRadius: corners.medium, alignSelf: 'flex-start',
  },
  demoBannerSmall: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  demoBannerText: { fontSize: 11, color: '#92400E', fontWeight: '700' },
  statusChip: { borderRadius: 20, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 6, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  visitCard: {
    minHeight: 140, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface,
    borderRadius: corners.large, padding: spacing.lg, gap: spacing.lg,
  },
  visitCardSelected: { borderColor: palette.primary, backgroundColor: '#FAFFFC' },
  visitCardCompact: { minHeight: 128 },
  pressed: { opacity: 0.76 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  cardTimeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  calendarDot: { width: 7, height: 7, backgroundColor: palette.primary, borderRadius: 4 },
  cardTime: { fontSize: 13, fontWeight: '700', color: palette.text },
  cardDate: { fontSize: 11, color: palette.textSecondary },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarCircle: {
    width: touchSize, height: touchSize, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: palette.mint,
  },
  avatarLetter: { fontWeight: '800', fontSize: 17, color: palette.deep },
  cardContent: { flex: 1, minWidth: 0, gap: spacing.xs },
  cardTitle: { color: palette.text, fontWeight: '700', fontSize: 15 },
  cardSubtitle: { color: palette.textSecondary, fontSize: 13 },
  cardKind: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  cardLocation: { color: palette.textMuted, fontSize: 12 },
  cardChevron: { color: palette.primary, fontSize: 26, fontWeight: '300' },
  screenHeading: { marginBottom: spacing.xl, gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  screenTitle: { color: palette.text, fontSize: 25, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6 },
  screenSubtitle: { color: palette.textSecondary, fontSize: 13, lineHeight: 21 },
  action: {
    minHeight: touchSize + 4, borderRadius: corners.medium, backgroundColor: palette.primary,
    paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: spacing.md,
  },
  actionLabel: { color: palette.surface, fontSize: 14, fontWeight: '700' },
  actionArrow: { color: palette.surface, fontSize: 19, fontWeight: '500' },
  outlineAction: { backgroundColor: palette.surface, borderColor: palette.borderStrong, borderWidth: 1 },
  outlineActionLabel: { color: palette.primary },
});

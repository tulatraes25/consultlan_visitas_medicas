import React, { useMemo, useState } from 'react';
import {
  Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  createDemoVisits, formatDemoDate, isPending, type DemoVisit,
} from './src/demoData';
import {
  BrandMark, DemoBanner, PrimaryAction, ScreenHeading, StatusChip, VisitCard,
} from './src/ui';
import { palette, corners, spacing, touchSize } from './src/theme';

type Tab = 'home' | 'agenda';
type AgendaFilter = 'all' | 'pending' | 'finished';

const sectionSteps = [
  { title: 'Asignación', description: 'La coordinación asignará una visita al profesional autorizado.' },
  { title: 'Registro asistencial', description: 'La especialidad determinará qué datos corresponde registrar.' },
  { title: 'Conformidad y firma', description: 'La constancia del familiar será independiente de la firma clínica.' },
  { title: 'Cierre verificado', description: 'Solo el servidor podrá confirmar la validez del cierre.' },
];

function InfoBox({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoHeading}>{heading}</Text>
      {children}
    </View>
  );
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.labelValue}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function SummaryStat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={[styles.summaryStat, accent && styles.summaryStatAccent]}>
      <Text style={[styles.summaryNumber, accent && styles.summaryNumberAccent]}>{value.toString().padStart(2, '0')}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function HomePanel({
  visits, onAgenda, onSelect,
}: {
  visits: DemoVisit[];
  onAgenda: () => void;
  onSelect: (id: string) => void;
}) {
  const today = visits[0]?.date;
  const todaysVisits = visits.filter(v => v.date === today);
  const upcoming = visits.filter(v => isPending(v.status)).slice(0, 2);
  const completed = todaysVisits.filter(v => v.status === 'CLOSED_VERIFIED').length;
  return (
    <View style={styles.page}>
      <ScreenHeading
        eyebrow="Tu espacio de trabajo"
        title="Mi jornada"
        subtitle="Consultá las prestaciones asignadas y el detalle de cada visita."
      />

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>PEDIATRICS · ATENCIÓN EN DOMICILIO</Text>
        <Text style={styles.heroTitle}>Cada visita, con claridad y seguimiento.</Text>
        <Text style={styles.heroBody}>
          Esta vista demuestra el funcionamiento de la futura agenda. Todos los pacientes son ficticios.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir agenda de demostración"
          onPress={onAgenda}
          style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
        >
          <Text style={styles.heroButtonText}>Explorar mi agenda</Text>
          <Text style={styles.heroButtonArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <SummaryStat value={todaysVisits.length} label="Visitas de hoy" accent />
        <SummaryStat value={todaysVisits.filter(v => isPending(v.status)).length} label="Pendientes" />
        <SummaryStat value={completed} label="Finalizadas (demo)" />
      </View>

      <View style={styles.sectionTitleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Próximas prestaciones</Text>
          <Text style={styles.sectionSubtitle}>Seleccioná una visita para ver su información simulada.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todas las visitas"
          onPress={onAgenda}
          style={styles.textLinkButton}
        >
          <Text style={styles.textLink}>Ver todas →</Text>
        </Pressable>
      </View>
      <View style={styles.cardList}>
        {upcoming.map(item => (
          <VisitCard key={item.id} visit={item} onPress={onSelect} />
        ))}
      </View>

      <InfoBox heading="Un entorno seguro desde el diseño">
        <Text style={styles.infoText}>
          Esta aplicación aún no accede a historias clínicas, domicilios reales ni servicios de firmas.
          El circuito clínico permanecerá bloqueado hasta que se validen sus permisos e integraciones.
        </Text>
      </InfoBox>
    </View>
  );
}

function VisitDetail({
  visit, isTablet, onBack,
}: { visit: DemoVisit; isTablet: boolean; onBack?: () => void }) {
  return (
    <View style={styles.detailPage}>
      {!isTablet && onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a la agenda"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Volver a la agenda</Text>
        </Pressable>
      ) : null}
      <ScreenHeading
        eyebrow={visit.reference}
        title={visit.patientLabel}
        subtitle="Detalle informativo de una visita ficticia."
      />
      <View style={styles.detailCard}>
        <View style={styles.detailStatus}>
          <Text style={styles.detailSectionTitle}>Prestación domiciliaria</Text>
          <StatusChip status={visit.status} />
        </View>
        <Text style={styles.specialtyTitle}>{visit.specialty}</Text>
        <Text style={styles.mutedText}>{visit.detail}</Text>
        <View style={styles.hairline} />
        <LabelValue label="Fecha" value={formatDemoDate(visit.date)} />
        <LabelValue label="Horario planificado" value={visit.timeRange} />
        <LabelValue label="Ubicación" value={visit.neighborhood} />
        <LabelValue label="Referencia" value={visit.reference} />
      </View>

      <Text style={styles.sectionTitle}>Circuito de visita previsto</Text>
      <View style={styles.timeline}>
        {sectionSteps.map((step, index) => (
          <View key={step.title} style={styles.timelineStep}>
            <View style={styles.stepCounter}>
              <Text style={styles.stepCounterText}>{index + 1}</Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <InfoBox heading="Registro y firma no disponibles en esta demostración">
        <Text style={styles.infoText}>
          No es posible iniciar una visita real, editar información clínica ni capturar firmas en
          esta versión. El diseño es navegable, pero no genera constancias legales o asistenciales.
        </Text>
      </InfoBox>
      {!isTablet && onBack ? (
        <PrimaryAction label="Volver a la agenda" onPress={onBack} outline />
      ) : null}
    </View>
  );
}

function AgendaPanel({
  visits, selectedId, onSelect, isTablet,
}: {
  visits: DemoVisit[];
  selectedId: string;
  onSelect: (id: string) => void;
  isTablet: boolean;
}) {
  const [filter, setFilter] = useState<AgendaFilter>('all');
  const [search, setSearch] = useState('');
  const filtered = visits.filter(visit => {
    if (filter === 'pending' && !isPending(visit.status)) return false;
    if (filter === 'finished' && isPending(visit.status)) return false;
    const term = search.trim().toLocaleLowerCase('es-AR');
    return !term || [visit.patientLabel, visit.reference, visit.specialty]
      .some(value => value.toLocaleLowerCase('es-AR').includes(term));
  });
  const selected = visits.find(item => item.id === selectedId) ?? visits[0];

  return (
    <View style={styles.page}>
      <ScreenHeading
        eyebrow="Prestaciones asignadas"
        title="Agenda domiciliaria"
        subtitle="Explorá tus visitas y filtrá por estado. No se conecta con datos de Pediatrics."
      />
      <View style={[styles.agendaColumns, isTablet && styles.agendaColumnsWide]}>
        <View style={[styles.agendaList, isTablet && styles.agendaListWide]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Buscar pacientes de demostración o especialidades"
            placeholder="Buscar visita o especialidad"
            placeholderTextColor={palette.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          <View style={styles.filterRow} accessibilityRole="radiogroup">
            {([
              { id: 'all', label: 'Todas' },
              { id: 'pending', label: 'Pendientes' },
              { id: 'finished', label: 'Finalizadas' },
            ] as const).map(item => (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: filter === item.id }}
                accessibilityLabel={`Filtrar visitas: ${item.label}`}
                onPress={() => setFilter(item.id)}
                style={[styles.filterButton, filter === item.id && styles.filterButtonActive]}
              >
                <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.resultsLabel}>
            {filtered.length} {filtered.length === 1 ? 'prestación simulada' : 'prestaciones simuladas'}
          </Text>
          <View style={styles.cardList}>
            {filtered.map(visit => (
              <VisitCard
                key={visit.id}
                visit={visit}
                compact={isTablet}
                onPress={onSelect}
                selected={isTablet && visit.id === selectedId}
              />
            ))}
            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No encontramos visitas</Text>
                <Text style={styles.infoText}>Probá otro filtro o término de búsqueda.</Text>
                <PrimaryAction
                  label="Restablecer búsqueda"
                  onPress={() => { setFilter('all'); setSearch(''); }}
                  outline
                />
              </View>
            ) : null}
          </View>
        </View>
        {isTablet ? (
          <View style={styles.agendaDetail}>
            <VisitDetail visit={selected} isTablet />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function NavigationButton({
  label, active, onPress, dark = false,
}: { label: string; active: boolean; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navButton,
        dark ? styles.navButtonDark : styles.navButtonLight,
        active && (dark ? styles.navButtonDarkActive : styles.navButtonLightActive),
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.navDot, active && styles.navDotActive]} />
      <Text style={[
        styles.navLabel, dark && styles.navLabelDark,
        active && (dark ? styles.navLabelDarkActive : styles.navLabelActive),
      ]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const isSplitAgenda = width >= 1180;
  const visits = useMemo(() => createDemoVisits(), []);
  const [tab, setTab] = useState<Tab>('home');
  const [selectedId, setSelectedId] = useState(visits[1]?.id ?? visits[0]?.id ?? '');
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const selectedVisit = visits.find(v => v.id === selectedId) ?? visits[0];

  function openTab(nextTab: Tab) {
    setTab(nextTab);
    setShowMobileDetail(false);
  }
  function openVisit(visitId: string) {
    setSelectedId(visitId);
    setTab('agenda');
    setShowMobileDetail(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={[styles.layout, isTablet && styles.layoutTablet]}>
        {isTablet ? (
          <View style={styles.sidebar}>
            <BrandMark dark />
            <Text style={styles.sidebarEyebrow}>ESPACIO PROFESIONAL</Text>
            <View style={styles.sidebarNav} accessibilityRole="tablist">
              <NavigationButton label="Inicio" dark active={tab === 'home'} onPress={() => openTab('home')} />
              <NavigationButton label="Agenda" dark active={tab === 'agenda'} onPress={() => openTab('agenda')} />
            </View>
            <View style={styles.sidebarBottom}>
              <DemoBanner small />
              <Text style={styles.sidebarFooter}>Sin conexión con la historia clínica ni firmas reales.</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.main}>
          {!isTablet ? (
            <View style={styles.mobileHeader}>
              <BrandMark />
              <DemoBanner small />
            </View>
          ) : (
            <View style={styles.desktopHeader}>
              <Text style={styles.headerTitle}>Panel de prestaciones domiciliarias</Text>
              <DemoBanner />
            </View>
          )}
          <ScrollView
            key={showMobileDetail && !isTablet ? 'detail' : tab}
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {showMobileDetail && !isSplitAgenda ? (
              <VisitDetail visit={selectedVisit} isTablet={false} onBack={() => openTab('agenda')} />
            ) : tab === 'home' ? (
              <HomePanel visits={visits} onAgenda={() => openTab('agenda')} onSelect={openVisit} />
            ) : (
              <AgendaPanel visits={visits} selectedId={selectedId} onSelect={openVisit} isTablet={isSplitAgenda} />
            )}
            <Text style={styles.footerNotice}>CONSULTLAN VISITAS · Prototipo sin uso asistencial</Text>
          </ScrollView>
          {!isTablet ? (
            <View style={styles.bottomTabs} accessibilityRole="tablist">
              <NavigationButton label="Inicio" active={tab === 'home' && !showMobileDetail} onPress={() => openTab('home')} />
              <NavigationButton label="Agenda" active={tab === 'agenda'} onPress={() => openTab('agenda')} />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.deep },
  layout: { flex: 1, backgroundColor: palette.canvas },
  layoutTablet: { flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  mobileHeader: {
    minHeight: 92, backgroundColor: palette.surface, borderBottomWidth: 1,
    borderColor: palette.border, justifyContent: 'center', padding: spacing.lg, gap: spacing.sm,
  },
  desktopHeader: {
    minHeight: 74, backgroundColor: palette.surface, borderBottomWidth: 1,
    borderColor: palette.border, paddingHorizontal: spacing.xxl,
    alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', gap: spacing.md,
  },
  headerTitle: { color: palette.text, fontSize: 16, fontWeight: '700' },
  sidebar: {
    width: 244, backgroundColor: palette.deep, padding: spacing.xl, gap: spacing.xl,
  },
  sidebarEyebrow: { marginTop: spacing.xl, fontSize: 10, fontWeight: '700', color: palette.brandMuted, letterSpacing: 1.3 },
  sidebarNav: { gap: spacing.sm },
  sidebarBottom: { marginTop: 'auto', gap: spacing.lg },
  sidebarFooter: { color: palette.brandMuted, fontSize: 12, lineHeight: 19 },
  navButton: {
    minHeight: touchSize, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    alignItems: 'center', borderRadius: corners.medium, flexDirection: 'row', gap: spacing.sm,
  },
  navButtonDark: { backgroundColor: 'transparent' },
  navButtonDarkActive: { backgroundColor: '#146B46' },
  navButtonLight: { backgroundColor: 'transparent', flex: 1, justifyContent: 'center' },
  navButtonLightActive: { backgroundColor: palette.primarySubtle },
  navDot: { height: 7, width: 7, borderRadius: 4, backgroundColor: palette.textMuted },
  navDotActive: { backgroundColor: palette.success },
  navLabel: { color: palette.textSecondary, fontSize: 14, fontWeight: '600' },
  navLabelActive: { color: palette.primary, fontWeight: '800' },
  navLabelDark: { color: palette.brandMuted },
  navLabelDarkActive: { color: palette.surface, fontWeight: '800' },
  bottomTabs: {
    flexDirection: 'row', minHeight: 66, backgroundColor: palette.surface,
    paddingHorizontal: spacing.xxl, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderColor: palette.border,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.huge, flexGrow: 1 },
  scrollContentTablet: { padding: spacing.xxl },
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
  detailPage: { gap: spacing.xl },
  hero: {
    padding: spacing.xxl, backgroundColor: palette.deep,
    borderRadius: corners.large, gap: spacing.lg,
  },
  heroEyebrow: { color: palette.brandMuted, fontWeight: '700', fontSize: 11, letterSpacing: 1.1 },
  heroTitle: { color: palette.surface, fontSize: 26, lineHeight: 34, fontWeight: '800', maxWidth: 440, letterSpacing: -0.5 },
  heroBody: { color: '#E0F1E8', fontSize: 13, lineHeight: 21, maxWidth: 510 },
  heroButton: {
    minHeight: 46, alignSelf: 'flex-start', paddingHorizontal: spacing.lg, borderRadius: corners.medium,
    backgroundColor: palette.mint, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  heroButtonText: { color: palette.deep, fontSize: 14, fontWeight: '700' },
  heroButtonArrow: { color: palette.deep, fontSize: 18 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  summaryStat: {
    flex: 1, minWidth: 96, borderRadius: corners.medium,
    backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1,
    padding: spacing.lg, minHeight: 94, justifyContent: 'center', gap: spacing.xs,
  },
  summaryStatAccent: { backgroundColor: palette.primarySubtle, borderColor: '#A7D7BD' },
  summaryNumber: { color: palette.text, fontSize: 25, fontWeight: '800' },
  summaryNumberAccent: { color: palette.primary },
  summaryLabel: { color: palette.textSecondary, fontSize: 11, fontWeight: '600' },
  sectionTitleRow: { marginTop: spacing.xxl, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { marginTop: 4, color: palette.textSecondary, fontSize: 12, lineHeight: 18 },
  textLinkButton: { minHeight: touchSize, justifyContent: 'center', paddingHorizontal: spacing.xs },
  textLink: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  cardList: { gap: spacing.md },
  infoBox: {
    backgroundColor: palette.primarySubtle, borderWidth: 1, borderColor: '#BBDFC8',
    borderRadius: corners.large, padding: spacing.lg, gap: spacing.sm, marginTop: spacing.xl,
  },
  infoHeading: { fontWeight: '800', fontSize: 14, color: palette.deep },
  infoText: { fontSize: 13, lineHeight: 20, color: palette.textSecondary },
  agendaColumns: { flexDirection: 'column', gap: spacing.xl },
  agendaColumnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  agendaList: { width: '100%', gap: spacing.md },
  agendaListWide: { width: 395, maxWidth: '44%' },
  agendaDetail: {
    flex: 1, minWidth: 0, backgroundColor: palette.surface,
    padding: spacing.xxl, borderRadius: corners.large,
    borderColor: palette.border, borderWidth: 1,
  },
  searchInput: {
    backgroundColor: palette.surface, minHeight: touchSize + 2,
    borderRadius: corners.medium, borderWidth: 1, borderColor: palette.borderStrong,
    color: palette.text, fontSize: 14, paddingHorizontal: spacing.lg,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterButton: {
    paddingHorizontal: spacing.md, minHeight: touchSize,
    borderRadius: 22, justifyContent: 'center', backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border,
  },
  filterButtonActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  filterText: { fontSize: 12, fontWeight: '700', color: palette.textSecondary },
  filterTextActive: { color: palette.surface },
  resultsLabel: { fontSize: 12, color: palette.textSecondary, fontWeight: '600' },
  detailCard: {
    borderWidth: 1, borderColor: palette.border, borderRadius: corners.large,
    backgroundColor: palette.surface, padding: spacing.xl, gap: spacing.lg,
  },
  detailStatus: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  detailSectionTitle: { fontSize: 12, fontWeight: '700', color: palette.textSecondary },
  specialtyTitle: { fontSize: 21, fontWeight: '800', color: palette.deep },
  mutedText: { fontSize: 13, lineHeight: 20, color: palette.textSecondary },
  labelValue: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  label: { fontSize: 12, color: palette.textSecondary, flex: 1 },
  value: { fontSize: 12, color: palette.text, fontWeight: '700', flex: 1.6, textAlign: 'right' },
  hairline: { backgroundColor: palette.border, height: 1 },
  timeline: { gap: spacing.lg },
  timelineStep: { flexDirection: 'row', gap: spacing.md },
  stepCounter: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: palette.mint, justifyContent: 'center', alignItems: 'center',
  },
  stepCounterText: { color: palette.deep, fontSize: 13, fontWeight: '800' },
  stepCopy: { flex: 1, gap: spacing.xs },
  stepTitle: { color: palette.text, fontSize: 14, fontWeight: '700' },
  stepDescription: { color: palette.textSecondary, fontSize: 12, lineHeight: 19 },
  emptyState: {
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    padding: spacing.xxl, borderRadius: corners.large, gap: spacing.lg, alignItems: 'flex-start',
  },
  emptyTitle: { color: palette.text, fontSize: 17, fontWeight: '700' },
  backButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: touchSize },
  backText: { color: palette.primary, fontSize: 14, fontWeight: '700' },
  footerNotice: { color: palette.textMuted, fontSize: 11, marginTop: spacing.xxl, textAlign: 'center' },
  pressed: { opacity: 0.78 },
});

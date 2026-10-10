import React, { useState } from 'react';
import {
  Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import type { Specialty } from './demoData';
import previewCatalog from './formPreviewCatalog.json';
import { ScreenHeading } from './ui';
import { corners, palette, spacing, touchSize } from './theme';

/**
 * HC-03B: structure-only clinical form preview.
 * The JSON projection is checked against source HC-03A contracts by CI.
 * No free-text inputs, patient identifiers, signature capture, or server calls.
 */
type CatalogGroup = 'attendance' | 'evolution' | 'paper';
type Form = (typeof previewCatalog.templates)[number];
type Paper = (typeof previewCatalog.paper)[number];
type Field = Form['headerFields'][number];

const categories: ReadonlyArray<{ id: CatalogGroup; label: string }> = [
  { id: 'attendance', label: 'Asistencia' },
  { id: 'evolution', label: 'Evolución' },
  { id: 'paper', label: 'Hojas en domicilio' },
];

const bySpecialty: Record<Specialty, string> = {
  Medicina: 'MEDICAL_ATTENDANCE',
  Enfermería: 'NURSING_CAREGIVER_ATTENDANCE',
  Kinesiología: 'PHYSIOTHERAPY_ATTENDANCE',
  Fonoaudiología: 'SPEECH_ATTENDANCE',
  'Terapia ocupacional': 'OCCUPATIONAL_THERAPY_ATTENDANCE',
  Nutrición: 'NUTRITION_ATTENDANCE',
};

export function formIdForSpecialty(specialty: Specialty): string {
  return bySpecialty[specialty];
}

function defaultId(group: CatalogGroup): string {
  if (group === 'evolution') return 'CLINICAL_EVOLUTION';
  if (group === 'paper') return 'KARDEX';
  return 'MEDICAL_ATTENDANCE';
}

function groupForTemplateId(id?: string): CatalogGroup {
  if (id && previewCatalog.paper.some(p => p.id === id)) return 'paper';
  if (id === 'CLINICAL_EVOLUTION') return 'evolution';
  return 'attendance';
}

function fieldHint(field: Field): string {
  switch (field.kind) {
    case 'CASE_CONTEXT': return 'Desde episodio autorizado · no disponible';
    case 'DATE_ONLY': return 'Fecha sin completar';
    case 'TIME_ONLY': return 'Horario sin completar';
    case 'PROFESSIONAL_SIGNATURE_REQUEST': return 'Firma profesional pendiente · no habilitada';
    case 'RESPONSIBLE_ATTESTATION_REQUEST': return 'Conformidad familiar pendiente · no habilitada';
    case 'CLINICAL_NARRATIVE': return 'Evolución bloqueada · sin captura clínica';
    default: return 'Campo no disponible';
  }
}

function PreviewFieldRow({ field }: { field: Field }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldTitle}>{field.sourceLabel}</Text>
      <Text style={styles.fieldHint}>{fieldHint(field)}</Text>
    </View>
  );
}

function FormPreview({ template }: { template: Form }) {
  const evolution = template.kind === 'CLINICAL_EVOLUTION';
  return (
    <View style={styles.previewCard} testID={`form-preview-${template.id}`}>
      <Text style={styles.kicker}>
        {evolution ? 'EVOLUCIÓN CLÍNICA · SIN EDICIÓN' : 'CONSTANCIA DE ASISTENCIA · SIN EDICIÓN'}
      </Text>
      <Text style={styles.detailTitle}>{template.source}</Text>
      <Text style={styles.help}>
        Vista de estructura derivada de las planillas recibidas. Los recuadros
        son solo etiquetas: no aceptan datos ni generan documentos.
      </Text>
      <Text style={styles.section}>Encabezado de la planilla</Text>
      <View style={styles.fieldList}>
        {template.headerFields.map(field => (
          <PreviewFieldRow key={field.id} field={field} />
        ))}
      </View>
      <Text style={styles.section}>
        {evolution ? 'Contenido previsto' : 'Campos por prestación'}
      </Text>
      <View style={styles.fieldList}>
        {template.rowFields.map(field => (
          <PreviewFieldRow key={field.id} field={field} />
        ))}
      </View>
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>No se puede guardar ni firmar</Text>
        <Text style={styles.warningText}>
          La firma del profesional y la conformidad del familiar requieren
          validaciones independientes. La visualización no acredita
          identidad, representación, indicaciones ni prestaciones realizadas.
        </Text>
      </View>
    </View>
  );
}

function PaperPreview({ record }: { record: Paper }) {
  return (
    <View style={styles.previewCard} testID={`paper-preview-${record.id}`}>
      <Text style={styles.kicker}>DOCUMENTACIÓN FÍSICA DEL DOMICILIO</Text>
      <Text style={styles.detailTitle}>{record.source}</Text>
      <Text style={styles.help}>
        No se digitaliza en esta aplicación. Se conserva en el domicilio
        según la indicación comunicada por Pediatrics.
      </Text>
      <Text style={styles.section}>Encabezados identificados en el original</Text>
      <View style={styles.fieldList}>
        {record.confirmedLabels.map(label => (
          <View key={label} style={styles.fieldRow}>
            <Text style={styles.fieldTitle}>{label}</Text>
            <Text style={styles.fieldHint}>Referencia visual únicamente</Text>
          </View>
        ))}
      </View>
      {record.unknownColumns ? (
        <Text style={styles.unknownNote}>
          Hay encabezados ilegibles o no confirmados; no fueron inventados.
        </Text>
      ) : null}
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>El documento permanece en papel</Text>
        {record.restrictions.map(restriction => (
          <Text style={styles.warningText} key={restriction}>• {restriction}</Text>
        ))}
      </View>
    </View>
  );
}

function CatalogItem({
  id, source, subtitle, active, onPress,
}: {
  id: string; source: string; subtitle: string;
  active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver estructura de ${source}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.catalogCard, active && styles.catalogCardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.catalogCopy}>
        <Text style={styles.catalogName}>{source}</Text>
        <Text style={styles.catalogSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron} accessibilityElementsHidden>›</Text>
    </Pressable>
  );
}

export function FormCatalogDemo({ initialTemplateId }: { initialTemplateId?: string }) {
  const { width } = useWindowDimensions();
  const split = width >= 1180;
  const authorizedInitial = previewCatalog.templates.some(t => t.id === initialTemplateId)
    || previewCatalog.paper.some(t => t.id === initialTemplateId)
    ? initialTemplateId
    : undefined;
  const [group, setGroup] = useState<CatalogGroup>(() => groupForTemplateId(authorizedInitial));
  const [selectedId, setSelectedId] = useState(() => authorizedInitial ?? defaultId('attendance'));
  const [showDetail, setShowDetail] = useState(Boolean(authorizedInitial));
  const candidates = group === 'paper'
    ? previewCatalog.paper
    : previewCatalog.templates.filter(x =>
      group === 'evolution' ? x.kind === 'CLINICAL_EVOLUTION' : x.kind === 'ATTENDANCE'
    );
  const selectedForm = previewCatalog.templates.find(x => x.id === selectedId);
  const selectedPaper = previewCatalog.paper.find(x => x.id === selectedId);

  function chooseGroup(value: CatalogGroup) {
    setGroup(value);
    setSelectedId(defaultId(value));
    setShowDetail(false);
  }
  function chooseTemplate(id: string) {
    setSelectedId(id);
    setShowDetail(true);
  }

  return (
    <View style={styles.page}>
      <ScreenHeading
        eyebrow="Documentación de internación domiciliaria"
        title="Planillas y constancias"
        subtitle="Explorá la estructura de las planillas originales. Sin historias clínicas ni firmas reales."
      />
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>SOLO PREVISUALIZACIÓN · SIN DATOS DE PACIENTES</Text>
        <Text style={styles.noticeBody}>
          Estas pantallas no registran asistencia, signos vitales, tratamientos o firmas.
          Los formularios siguen pendientes de aprobación institucional.
        </Text>
      </View>
      <View style={styles.categoryRow} accessibilityRole="radiogroup">
        {categories.map(option => (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={`Categoría de planillas: ${option.label}`}
            accessibilityState={{ checked: group === option.id }}
            onPress={() => chooseGroup(option.id)}
            style={[styles.category, group === option.id && styles.categorySelected]}
          >
            <Text style={[styles.categoryText, group === option.id && styles.categoryTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.layout, split && styles.layoutWide]}>
        {(!showDetail || split) ? (
          <View style={[styles.catalog, split && styles.catalogWide]} testID="form-catalog-list">
            <Text style={styles.catalogHeading}>
              {group === 'paper' ? 'Documentos que quedan en casa' :
                group === 'evolution' ? 'Evoluciones del equipo' : 'Constancias por especialidad'}
            </Text>
            <Text style={styles.counter}>
              {candidates.length} {candidates.length === 1 ? 'modelo disponible' : 'modelos disponibles'}
            </Text>
            {candidates.map(item => (
              <CatalogItem
                key={item.id}
                id={item.id}
                source={item.source}
                subtitle={group === 'paper'
                  ? 'Referencia al papel físico'
                  : group === 'evolution'
                    ? 'Separada de la asistencia'
                    : 'Sin captura ni firma habilitadas'}
                active={selectedId === item.id}
                onPress={() => chooseTemplate(item.id)}
              />
            ))}
          </View>
        ) : null}
        {(showDetail || split) ? (
          <View style={styles.detailPane}>
            {!split ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Volver al catálogo de planillas"
                onPress={() => setShowDetail(false)}
                style={styles.back}
              >
                <Text style={styles.backText}>← Volver al catálogo</Text>
              </Pressable>
            ) : null}
            {group === 'paper' && selectedPaper ? (
              <PaperPreview record={selectedPaper} />
            ) : selectedForm ? (
              <FormPreview template={selectedForm} />
            ) : (
              <Text style={styles.help}>Elegí una plantilla para revisar su estructura.</Text>
            )}
          </View>
        ) : null}
      </View>
      <View style={styles.footnote}>
        <Text style={styles.footnoteTitle}>Expediente mensual de referencia</Text>
        <Text style={styles.help}>
          {previewCatalog.monthlyDossier.source}: el contenido completo no está
          transcrito ni se importarán automáticamente pacientes o firmas.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center', gap: spacing.lg },
  notice: {
    backgroundColor: palette.primarySubtle, borderRadius: corners.large,
    padding: spacing.lg, borderWidth: 1, borderColor: palette.brandMuted,
    gap: spacing.sm,
  },
  noticeTitle: { color: palette.deep, fontSize: 12, fontWeight: '800', letterSpacing: .4 },
  noticeBody: { color: palette.textSecondary, fontSize: 13, lineHeight: 20 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: {
    minHeight: touchSize, paddingHorizontal: spacing.lg, borderRadius: 24,
    backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1,
    justifyContent: 'center',
  },
  categorySelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  categoryText: { color: palette.textSecondary, fontSize: 12, fontWeight: '700' },
  categoryTextActive: { color: palette.onPrimary },
  layout: { flexDirection: 'column', gap: spacing.xl },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  catalog: { gap: spacing.sm },
  catalogWide: { width: 330, flexShrink: 0 },
  catalogHeading: { fontSize: 17, color: palette.text, fontWeight: '800' },
  counter: { color: palette.textSecondary, fontSize: 12, marginBottom: spacing.xs },
  catalogCard: {
    minHeight: 72, borderRadius: corners.medium, padding: spacing.lg,
    borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  catalogCardActive: { backgroundColor: palette.primarySubtle, borderColor: palette.primary },
  catalogCopy: { flex: 1, gap: spacing.xs },
  catalogName: { color: palette.text, fontSize: 14, fontWeight: '800' },
  catalogSubtitle: { color: palette.textSecondary, fontSize: 12 },
  chevron: { fontSize: 24, color: palette.primary },
  detailPane: { flex: 1, minWidth: 0, gap: spacing.md },
  back: { minHeight: touchSize, alignSelf: 'flex-start', justifyContent: 'center' },
  backText: { color: palette.primary, fontSize: 14, fontWeight: '800' },
  previewCard: {
    backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1,
    borderRadius: corners.large, padding: spacing.xl, gap: spacing.md,
  },
  kicker: { fontSize: 11, color: palette.primary, letterSpacing: 1, fontWeight: '800' },
  detailTitle: { fontSize: 21, color: palette.deep, fontWeight: '800' },
  help: { fontSize: 13, lineHeight: 20, color: palette.textSecondary },
  section: { fontSize: 15, color: palette.text, fontWeight: '800', marginTop: spacing.sm },
  fieldList: { gap: spacing.sm },
  fieldRow: {
    padding: spacing.md, borderRadius: corners.medium, backgroundColor: palette.subtle,
    borderWidth: 1, borderColor: palette.border, gap: spacing.xs,
  },
  fieldTitle: { color: palette.text, fontWeight: '700', fontSize: 13 },
  fieldHint: { color: palette.textSecondary, fontSize: 12, lineHeight: 18 },
  warningBox: {
    backgroundColor: '#FFFBEB', borderColor: '#F5D893', borderWidth: 1,
    borderRadius: corners.medium, padding: spacing.lg, gap: spacing.sm,
  },
  warningTitle: { color: '#92400E', fontSize: 13, fontWeight: '800' },
  warningText: { color: '#92400E', fontSize: 12, lineHeight: 19 },
  unknownNote: { color: palette.warning, fontWeight: '700', fontSize: 12 },
  footnote: {
    backgroundColor: palette.surface, borderColor: palette.border,
    borderWidth: 1, padding: spacing.lg, borderRadius: corners.medium, gap: spacing.xs,
  },
  footnoteTitle: { fontWeight: '800', color: palette.text, fontSize: 13 },
  pressed: { opacity: .78 },
});

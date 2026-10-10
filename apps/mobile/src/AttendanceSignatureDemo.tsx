import React, { useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
  type GestureResponderEvent, type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { DemoVisit } from './demoData';
import { formatDemoTimeRange } from './coverageDemo';
import { palette, corners, spacing, touchSize } from './theme';

/**
 * In-memory stroke capture for UX validation only.
 * This component DOES NOT authenticate signers, send data, persist strokes,
 * issue documents, or create an electronic/digital signature.
 */
type InkPoint = Readonly<{ x: number; y: number }>;
type InkStroke = ReadonlyArray<InkPoint>;
const VIRTUAL_W = 320;
const VIRTUAL_H = 180;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

function toInkPoint(event: GestureResponderEvent, actual: { width: number; height: number }): InkPoint | null {
  const x = event.nativeEvent.locationX;
  const y = event.nativeEvent.locationY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp((x / Math.max(1, actual.width)) * VIRTUAL_W, 0, VIRTUAL_W),
    y: clamp((y / Math.max(1, actual.height)) * VIRTUAL_H, 0, VIRTUAL_H),
  };
}

function toPath(stroke: InkStroke): string {
  return stroke.map((p, index) =>
    `${index === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
  ).join(' ');
}

export function SignaturePadDemo() {
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [layout, setLayout] = useState({ width: VIRTUAL_W, height: VIRTUAL_H });

  const updateSize = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  const startStroke = (event: GestureResponderEvent) => {
    const point = toInkPoint(event, layout);
    if (point) setStrokes(previous => [...previous, [point]]);
  };
  const extendStroke = (event: GestureResponderEvent) => {
    const point = toInkPoint(event, layout);
    if (!point) return;
    setStrokes(previous => {
      if (!previous.length) return previous;
      const tail = previous[previous.length - 1];
      const last = tail[tail.length - 1];
      if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) {
        return previous;
      }
      return [...previous.slice(0, -1), [...tail, point]];
    });
  };

  return (
    <View style={styles.padOuter}>
      <View
        accessibilityLabel="Área de dibujo táctil de demostración"
        testID="demo-signature-pad"
        style={styles.pad}
        onLayout={updateSize}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={startStroke}
        onResponderMove={extendStroke}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIRTUAL_W} ${VIRTUAL_H}`} pointerEvents="none">
          {strokes.map((stroke, index) => stroke.length === 1 ? (
            <Circle key={index} cx={stroke[0].x} cy={stroke[0].y} r={2} fill={palette.deep} />
          ) : (
            <Path
              key={index} d={toPath(stroke)} fill="none"
              stroke={palette.deep} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
            />
          ))}
        </Svg>
        {strokes.length === 0 ? (
          <View style={styles.placeholder} pointerEvents="none">
            <Text style={styles.placeholderText}>Dibujá con el dedo o lápiz</Text>
            <Text style={styles.placeholderSubtext}>Práctica visual, no es una firma válida</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.padToolbar}>
        <Text style={styles.padCount} testID="demo-stroke-count">Trazos: {strokes.length}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Borrar trazos de demostración"
          onPress={() => setStrokes([])}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
        >
          <Text style={styles.clearText}>Borrar trazos</Text>
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>
        Los trazos existen únicamente en la memoria de esta ventana. Se eliminan al cerrarla;
        no se transmiten, autentican ni incorporan a documentos.
      </Text>
    </View>
  );
}

type SimulatedRelationship = 'PARENT' | 'TUTOR' | 'AUTHORIZED_CAREGIVER';
const RELATIONSHIPS: ReadonlyArray<{ code: SimulatedRelationship; label: string }> = [
  { code: 'PARENT', label: 'Padre / madre' },
  { code: 'TUTOR', label: 'Tutor' },
  { code: 'AUTHORIZED_CAREGIVER', label: 'Cuidador autorizado' },
];

export function AttendanceSignatureDemo({
  visit, visible, onClose,
}: { visit: DemoVisit; visible: boolean; onClose: () => void }) {
  const [relationship, setRelationship] = useState<SimulatedRelationship>('PARENT');

  // Explicitly unmount the entire pad when closed. Never retain a drawn signature.
  if (!visible) return null;
  return (
    <Modal
      visible transparent animationType="slide"
      accessibilityViewIsModal
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>PEDIATRICS · MODO DEMO</Text>
                <Text style={styles.title}>Ventana táctil de firma</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar ventana de firma de demostración"
                onPress={onClose}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.warning}>
              <Text style={styles.warningTitle}>SIMULACIÓN SIN VALIDEZ LEGAL</Text>
              <Text style={styles.warningDescription}>
                Nadie está firmando una prestación real. Esta pantalla solo permite probar el
                gesto de dibujar una firma, sin guardar ni enviar información.
              </Text>
            </View>

            <Text style={styles.sectionLabel}>RESUMEN DE PRESTACIÓN FICTICIA</Text>
            <View style={styles.visitSummary}>
              <Text style={styles.summaryName}>{visit.patientLabel}</Text>
              <Text style={styles.summaryLine}>{visit.specialty} · {formatDemoTimeRange(visit.startTime, visit.endTime)}</Text>
              <Text style={styles.summaryReference}>{visit.reference}</Text>
            </View>

            <Text style={styles.sectionLabel}>RELACIÓN CON EL PACIENTE (NO VERIFICADA)</Text>
            <View style={styles.relationshipRow} accessibilityRole="radiogroup">
              {RELATIONSHIPS.map(item => (
                <Pressable
                  key={item.code}
                  accessibilityRole="radio"
                  accessibilityLabel={`Vínculo de muestra: ${item.label}`}
                  accessibilityState={{ checked: relationship === item.code }}
                  onPress={() => setRelationship(item.code)}
                  style={[styles.relationshipButton, relationship === item.code && styles.relationshipSelected]}
                >
                  <Text style={[styles.relationshipText, relationship === item.code && styles.relationshipTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.relationshipWarning}>
              Elegir un vínculo no acredita identidad ni representación legal.
            </Text>

            <Text style={styles.sectionLabel}>ÁREA DE TRAZOS TÁCTILES</Text>
            <SignaturePadDemo />

            <View style={styles.separation} />
            <Text style={styles.professionalNote}>
              La firma digital del profesional requiere un certificado y verificación por un
              servicio de confianza. No se implementa mediante esta ventana.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar y descartar demostración"
              onPress={onClose}
              style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
            >
              <Text style={styles.dismissText}>Cerrar y descartar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(7,42,29,0.68)', padding: spacing.lg,
  },
  sheet: {
    width: '100%', maxWidth: 660, maxHeight: '94%',
    borderRadius: corners.large, backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  sheetBody: { padding: spacing.xl, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  eyebrow: { color: palette.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: palette.deep, fontSize: 22, fontWeight: '800' },
  closeButton: {
    height: touchSize, width: touchSize, borderRadius: 22,
    backgroundColor: palette.primarySubtle, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: 19, color: palette.primary, fontWeight: '700' },
  warning: {
    borderRadius: corners.medium, borderColor: '#EBC08E', borderWidth: 1,
    padding: spacing.md, gap: spacing.xs, backgroundColor: '#FFF7DD',
  },
  warningTitle: { fontSize: 12, fontWeight: '800', color: '#92400E' },
  warningDescription: { fontSize: 12, color: '#92400E', lineHeight: 19 },
  sectionLabel: { fontSize: 11, color: palette.textSecondary, fontWeight: '800', letterSpacing: 0.8 },
  visitSummary: {
    borderWidth: 1, borderColor: palette.border, borderRadius: corners.medium,
    padding: spacing.lg, backgroundColor: palette.subtle, gap: spacing.xs,
  },
  summaryName: { fontSize: 16, fontWeight: '800', color: palette.text },
  summaryLine: { fontSize: 13, color: palette.textSecondary },
  summaryReference: { fontSize: 11, color: palette.textMuted },
  relationshipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  relationshipButton: {
    minHeight: touchSize, paddingHorizontal: spacing.md,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: corners.medium, borderWidth: 1, borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  relationshipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  relationshipText: { color: palette.textSecondary, fontSize: 12, fontWeight: '700' },
  relationshipTextSelected: { color: palette.surface },
  relationshipWarning: { color: palette.warning, fontSize: 11, lineHeight: 17 },
  padOuter: { gap: spacing.sm },
  pad: {
    height: 180, borderRadius: corners.medium, borderWidth: 1.5,
    borderColor: palette.primary, backgroundColor: '#FBFFFC', overflow: 'hidden',
  },
  placeholder: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  placeholderText: { fontSize: 14, fontWeight: '700', color: palette.textMuted },
  placeholderSubtext: { fontSize: 11, color: palette.textMuted },
  padToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  padCount: { fontSize: 12, color: palette.textSecondary, fontWeight: '700' },
  clearButton: { minHeight: touchSize, justifyContent: 'center', paddingHorizontal: spacing.md },
  clearText: { fontSize: 12, color: palette.primary, fontWeight: '800' },
  disclaimer: { fontSize: 11, lineHeight: 18, color: palette.textSecondary },
  separation: { backgroundColor: palette.border, height: 1 },
  professionalNote: { color: palette.textSecondary, fontSize: 12, lineHeight: 19 },
  dismiss: {
    minHeight: touchSize + 4, borderRadius: corners.medium,
    backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center',
  },
  dismissText: { color: palette.surface, fontWeight: '800', fontSize: 14 },
  pressed: { opacity: 0.78 },
});

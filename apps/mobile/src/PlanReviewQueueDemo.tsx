import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScreenHeading } from "./ui";
import { palette, corners, spacing } from "./theme";

/**
 * MOB-HC-REVIEW-01: read-only synthetic view.
 * No Supabase calls, patients, approval, credentials, consent or signatures.
 */
const sampleRequests = Object.freeze([
  { code: "CASO-DEMO-A", version: 1, request: "REV-DEMO-01" },
  { code: "CASO-DEMO-B", version: 2, request: "REV-DEMO-02" },
]);

export function PlanReviewQueueDemo() {
  return (
    <View style={styles.root} testID="plan-review-demo">
      <ScreenHeading
        eyebrow="Planificación · DEMO"
        title="Solicitudes de revisión"
        subtitle="Referencias ficticias para visualizar el circuito administrativo. No son planes médicos."
      />
      <View style={styles.notice}>
        <Text style={styles.noticeHeading}>SIN APROBACIONES NI ACTIVACIÓN CLÍNICA</Text>
        <Text style={styles.noticeBody}>
          Solicitar una revisión NO autoriza un plan de cuidados, una indicación médica,
          una firma profesional ni el inicio de una internación domiciliaria.
        </Text>
      </View>
      <Text style={styles.sectionTitle}>Solicitudes de ejemplo · {sampleRequests.length}</Text>
      {sampleRequests.map(item => (
        <View key={item.request} style={styles.card} testID={"review-" + item.request}>
          <View style={styles.row}>
            <Text style={styles.reference}>{item.request}</Text>
            <View style={styles.status}>
              <Text style={styles.statusText}>PENDIENTE</Text>
            </View>
          </View>
          <Text style={styles.detail}>Episodio: {item.code}</Text>
          <Text style={styles.detail}>Versión de plan: {item.version}</Text>
          <Text style={styles.detail}>Sin revisión clínica efectuada ni identidad médica validada.</Text>
        </View>
      ))}
      <View style={styles.notice}>
        <Text style={styles.noticeBody}>
          Esta pantalla es únicamente de lectura y contiene datos sintéticos.
          La solicitud real requerirá autenticación y autorización del servidor
          Supabase independiente. No existe función de aprobar, firmar o activar.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  notice: {
    borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.primarySubtle,
    borderRadius: corners.medium, padding: spacing.lg, gap: spacing.sm,
  },
  noticeHeading: { fontSize: 12, fontWeight: "800", color: palette.deep },
  noticeBody: { fontSize: 12, lineHeight: 20, color: palette.textSecondary },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: palette.deep },
  card: {
    backgroundColor: palette.surface, borderRadius: corners.medium,
    borderWidth: 1, borderColor: palette.border, padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, justifyContent: "space-between" },
  reference: { fontSize: 13, fontWeight: "800", color: palette.text },
  status: { borderRadius: corners.medium, borderWidth: 1, borderColor: "#EBC08E",
    backgroundColor: "#FFF7DD", paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  statusText: { fontSize: 11, fontWeight: "800", color: "#92400E" },
  detail: { fontSize: 12, color: palette.textSecondary },
});

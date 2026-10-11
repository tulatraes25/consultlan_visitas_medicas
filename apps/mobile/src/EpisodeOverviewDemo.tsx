import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DemoVisit } from "./demoData";
import { formatDemoDate, statusLabel } from "./demoData";
import type { DemoPatient, DemoProfessional } from "./adminDemoData";
import { coverageKindLabel, findDemoContinuityHints, formatDemoTimeRange } from "./coverageDemo";
import { ScreenHeading } from "./ui";
import { corners, palette, spacing, touchSize } from "./theme";

/**
 * MOB-HC-EPISODE-01: nonclinical, read-only projections of synthetic visits.
 * A case/episode, rather than a standalone appointment, is the aggregation key.
 * No request is ever sent to Supabase and no real clinical status is implied.
 */
export function demoEpisodeCoverages(
  patient: DemoPatient | undefined,
  visits: readonly DemoVisit[],
): DemoVisit[] {
  if (!patient || !/^DEMO-PAT-[A-Z0-9]{1,4}$/.test(patient.id) ||
      !/^DEMO-EPI-[A-Z0-9]{1,4}$/.test(patient.episodeRef)) return [];
  return visits.filter(visit =>
    visit.id.startsWith("DEMO-") &&
    visit.patientRef === patient.id &&
    visit.episodeRef === patient.episodeRef
  ).sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.startTime.localeCompare(b.startTime) ||
    a.id.localeCompare(b.id)
  );
}

/** No source-supplied name, title or registration number is displayed. */
export function syntheticProfessionalLabel(
  professional: DemoProfessional | undefined,
): string {
  const match = professional?.id.match(/^DEMO-PRO-(?:([0-9]+)|CODE-([A-Z0-9]{1,4}))$/);
  return match
    ? "Profesional ficticio " + (match[1] ?? match[2])
    : "Profesional ficticio no identificado";
}

export type DemoEpisodeParticipant = Readonly<{
  professionalRef: string;
  label: string;
  specialty: DemoProfessional["specialty"];
  visits: number;
  shifts: number;
}>;

/**
 * Show only people with demonstrative coverages in this exact case.
 * NOT a clinical care team, personnel certification or approved assignment.
 * Specialty is taken from the synthetic registry, never from free text.
 */
export function demoEpisodeParticipants(
  patient: DemoPatient | undefined,
  professionals: readonly DemoProfessional[],
  visits: readonly DemoVisit[],
): DemoEpisodeParticipant[] {
  const eligible = demoEpisodeCoverages(patient, visits);
  const counts = new Map<string, DemoEpisodeParticipant>();
  const seen = new Set<string>();
  for (const visit of eligible) {
    if (visit.serviceKind !== "VISIT" && visit.serviceKind !== "SHIFT") continue;
    if (seen.has(visit.id)) continue;
    seen.add(visit.id);
    const professional = professionals.find(item =>
      item.id === visit.professionalRef && item.specialty === visit.specialty &&
      /^DEMO-PRO-(?:[0-9]+|CODE-[A-Z0-9]{1,4})$/.test(item.id)
    );
    if (!professional) continue;
    const current = counts.get(professional.id);
    counts.set(professional.id, {
      professionalRef: professional.id,
      label: syntheticProfessionalLabel(professional),
      specialty: professional.specialty,
      visits: (current?.visits ?? 0) + Number(visit.serviceKind === "VISIT"),
      shifts: (current?.shifts ?? 0) + Number(visit.serviceKind === "SHIFT"),
    });
  }
  return [...counts.values()].sort((a, b) =>
    a.specialty.localeCompare(b.specialty, "es-AR") ||
    a.professionalRef.localeCompare(b.professionalRef)
  );
}

export function EpisodeOverviewDemo({
  patients, professionals, visits,
}: {
  patients: readonly DemoPatient[];
  professionals: readonly DemoProfessional[];
  visits: readonly DemoVisit[];
}) {
  const [selectedEpisode, setSelectedEpisode] = useState(patients[0]?.episodeRef ?? "");
  const patient = patients.find(item => item.episodeRef === selectedEpisode) ?? patients[0];
  const coverages = demoEpisodeCoverages(patient, visits);
  const shifts = coverages.filter(item => item.serviceKind === "SHIFT").length;
  const visitsCount = coverages.length - shifts;
  const participants = demoEpisodeParticipants(patient, professionals, coverages);
  // The only permissible source is the already patient+episode-scoped list.
  const continuity = findDemoContinuityHints(coverages);

  return (
    <View style={styles.root} testID="demo-homecare-episodes">
      <ScreenHeading
        eyebrow="Continuidad de cuidados · DEMO"
        title="Episodios domiciliarios"
        subtitle="Cada cobertura pertenece a un episodio, no a un turno de consultorio."
      />
      <View style={styles.warning}>
        <Text style={styles.warningHeading}>
          EPISODIOS SIMULADOS · SIN ADMISIÓN CLÍNICA
        </Text>
        <Text style={styles.help}>
          No hay planes de cuidados aprobados, diagnósticos, documentación
          clínica, consentimiento, identidad profesional validada ni
          pacientes reales. Todos los datos son ficticios y temporales.
        </Text>
      </View>

      <Text style={styles.sectionHeading}>
        Seleccionar episodio de muestra
      </Text>
      <View style={styles.selector}>
        {patients.map(item => (
          <Pressable
            key={item.episodeRef}
            accessibilityRole="button"
            accessibilityLabel={"Ver episodio de " + item.label}
            accessibilityState={{ selected: patient?.episodeRef === item.episodeRef }}
            onPress={() => setSelectedEpisode(item.episodeRef)}
            style={[styles.selectButton,
              patient?.episodeRef === item.episodeRef && styles.selectButtonActive]}
          >
            <Text style={[styles.selectText,
              patient?.episodeRef === item.episodeRef && styles.selectTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {patient ? (
        <View style={styles.episodeCard}>
          <Text style={styles.cardKicker}>EPISODIO LONGITUDINAL · SOLO DEMO</Text>
          <Text style={styles.episodeTitle}>{patient.episodeRef}</Text>
          <Text style={styles.help}>{patient.label}</Text>
          <Text style={styles.warningText}>
            Sin autorización médica ni estado ACTIVE confirmado
          </Text>
          <View style={styles.summary}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{coverages.length}</Text>
              <Text style={styles.metricLabel}>Coberturas</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{visitsCount}</Text>
              <Text style={styles.metricLabel}>Visitas</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{shifts}</Text>
              <Text style={styles.metricLabel}>Guardias</Text>
            </View>
          </View>

          <Text style={styles.sectionHeading}>
            Profesionales con coberturas ficticias
          </Text>
          {participants.length > 0 ? (
            <View style={styles.participantList} testID="episode-demo-participants">
              {participants.map(member => (
                <View key={member.professionalRef} style={styles.participantCard}
                  testID={"episode-participant-" + member.professionalRef}>
                  <Text style={styles.participantName}>{member.label} · {member.specialty}</Text>
                  <Text style={styles.help}>
                    {member.visits} {member.visits === 1 ? "visita" : "visitas"} · {member.shifts} {member.shifts === 1 ? "guardia" : "guardias"} de muestra
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.help} testID="episode-demo-participants-empty">
              Sin profesionales asociados a coberturas ficticias en este episodio.
            </Text>
          )}
          <Text style={styles.help}>
            Este listado no acredita equipo asistencial, matrícula ni asignación clínica.
          </Text>

          <Text style={styles.sectionHeading}>
            Agenda vinculada al episodio · simulación
          </Text>
          {coverages.length ? coverages.map(visit => {
            const professional = professionals.find(p => p.id === visit.professionalRef);
            return (
              <View key={visit.id} style={styles.coverageCard} testID={"episode-coverage-" + visit.id}>
                <Text style={styles.coverageRef}>{visit.reference}</Text>
                <Text style={styles.coverageName}>
                  {coverageKindLabel(visit.serviceKind)} · {visit.specialty}
                </Text>
                <Text style={styles.help}>
                  {formatDemoDate(visit.date)} · {formatDemoTimeRange(visit.startTime, visit.endTime)}
                </Text>
                <Text style={styles.help}>
                  {syntheticProfessionalLabel(professional)}
                </Text>
                <Text style={styles.help}>{statusLabel(visit.status)}</Text>
              </View>
            );
          }) : (
            <Text style={styles.help} testID="episode-empty">
              Este episodio ficticio no tiene coberturas simuladas.
            </Text>
          )}

          <Text style={styles.sectionHeading}>
            Posibles continuidades de guardia · DEMO
          </Text>
          {continuity.length > 0 ? (
            <View style={styles.continuityList} testID="episode-continuity-list">
              {continuity.map(pair => {
                const outgoing = coverages.find(item => item.id === pair.outgoingId);
                const incoming = coverages.find(item => item.id === pair.incomingId);
                if (!outgoing || !incoming) return null;
                const from = professionals.find(item => item.id === outgoing.professionalRef);
                const to = professionals.find(item => item.id === incoming.professionalRef);
                return (
                  <View key={pair.outgoingId + "-" + pair.incomingId}
                    style={styles.continuityCard} testID={"episode-continuity-" + pair.outgoingId}>
                    <Text style={styles.continuityLabel}>HORARIOS CONSECUTIVOS · SIN RELEVO ACREDITADO</Text>
                    <Text style={styles.coverageName}>
                      {outgoing.reference} → {incoming.reference}
                    </Text>
                    <Text style={styles.help}>
                      {formatDemoDate(incoming.date)} · cambio previsto a las {incoming.startTime}
                    </Text>
                    <Text style={styles.help}>
                      {syntheticProfessionalLabel(from)} → {syntheticProfessionalLabel(to)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.help} testID="episode-continuity-empty">
              Sin guardias consecutivas de distintos profesionales en este episodio ficticio.
            </Text>
          )}
          <Text style={styles.help}>
            La coincidencia horaria no acredita un relevo, transmisión de información,
            aceptación profesional ni continuidad asistencial real.
          </Text>

          <View style={styles.footnote}>
            <Text style={styles.help}>
              Esta vista no confirma admisión, indicaciones, relevos,
              prestación realizada ni una evolución médica. La autorización
              y el acceso a información clínica serán exclusivos del servidor.
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.help}>Sin episodios ficticios disponibles.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  warning: {
    backgroundColor: "#FFF7DD", borderColor: "#EBC08E",
    borderWidth: 1, borderRadius: corners.medium,
    padding: spacing.lg, gap: spacing.sm,
  },
  warningHeading: { color: "#92400E", fontSize: 12, fontWeight: "800" },
  warningText: { color: "#92400E", fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  help: { color: palette.textSecondary, fontSize: 12, lineHeight: 19 },
  sectionHeading: { color: palette.deep, fontSize: 15, fontWeight: "800" },
  selector: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  selectButton: {
    minHeight: touchSize, borderWidth: 1, borderColor: palette.borderStrong,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: corners.medium, justifyContent: "center",
    backgroundColor: palette.surface,
  },
  selectButtonActive: { borderColor: palette.primary, backgroundColor: palette.primarySubtle },
  selectText: { color: palette.textSecondary, fontSize: 12, fontWeight: "700" },
  selectTextActive: { color: palette.primary },
  episodeCard: {
    padding: spacing.lg, borderRadius: corners.large, borderWidth: 1,
    borderColor: palette.border, backgroundColor: palette.surface,
    gap: spacing.md,
  },
  cardKicker: { fontSize: 11, fontWeight: "800", color: palette.primary },
  episodeTitle: { fontSize: 20, fontWeight: "800", color: palette.deep },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginVertical: spacing.sm },
  metric: {
    minWidth: 76, flexGrow: 1, borderRadius: corners.medium, padding: spacing.md,
    backgroundColor: palette.primarySubtle, alignItems: "center", gap: spacing.xs,
  },
  metricValue: { fontSize: 20, fontWeight: "800", color: palette.deep },
  metricLabel: { fontSize: 11, color: palette.textSecondary, fontWeight: "700" },
  participantList: { gap: spacing.sm },
  participantCard: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: corners.medium, backgroundColor: palette.surface, gap: spacing.xs,
  },
  participantName: { fontSize: 13, fontWeight: "700", color: palette.deep },
  coverageCard: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, borderRadius: corners.medium, gap: spacing.xs,
  },
  continuityList: { gap: spacing.sm },
  continuityCard: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.borderStrong,
    borderRadius: corners.medium, backgroundColor: palette.primarySubtle, gap: spacing.xs,
  },
  continuityLabel: { fontSize: 10, fontWeight: "800", color: palette.textSecondary },
  coverageRef: { fontSize: 12, fontWeight: "800", color: palette.primary },
  coverageName: { fontSize: 14, fontWeight: "700", color: palette.deep },
  footnote: { padding: spacing.md, borderRadius: corners.medium, backgroundColor: palette.primarySubtle },
});

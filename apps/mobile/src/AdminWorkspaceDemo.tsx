import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { DemoVisit, Specialty } from "./demoData";
import {
  SPECIALTIES, nextDemoDay, type DemoPatient, type DemoProfessional,
} from "./adminDemoData";
import {
  coverageDurationLabel, findDemoContinuityHints, formatDemoTimeRange,
  resolveDemoWindow, type DemoCoverageKind,
} from "./coverageDemo";
import { PrimaryAction, ScreenHeading } from "./ui";
import { PlanReviewQueueDemo } from "./PlanReviewQueueDemo";
import { EpisodeOverviewDemo } from "./EpisodeOverviewDemo";
import { ProfessionalRosterPreviewDemo } from "./ProfessionalRosterPreviewDemo";
import { corners, palette, spacing, touchSize } from "./theme";

type Section = "patients" | "professionals" | "assignments" | "reviews" | "episodes" | "professional-preview";

function Choice({
  label, selected, onPress, accessibilityLabel,
}: {
  label: string; selected: boolean; onPress: () => void; accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function AdminWorkspaceDemo({
  patients, professionals, visits, onCreatePatient, onCreateProfessional,
  onAssign, onOpenAgenda,
}: {
  patients: readonly DemoPatient[];
  professionals: readonly DemoProfessional[];
  visits: readonly DemoVisit[];
  onCreatePatient: (code: string) => boolean;
  onCreateProfessional: (code: string, specialty: Specialty) => boolean;
  onAssign: (patientId: string, professionalId: string, kind: DemoCoverageKind,
    day: string, startTime: string, endTime: string) => boolean;
  onOpenAgenda: () => void;
}) {
  const [section, setSection] = useState<Section>("patients");
  const [patientCode, setPatientCode] = useState("");
  const [professionalCode, setProfessionalCode] = useState("");
  const [specialty, setSpecialty] = useState<Specialty>("Enfermería");
  const [selectedPatient, setSelectedPatient] = useState(patients[0]?.id ?? "");
  const [selectedProfessional, setSelectedProfessional] = useState(professionals[0]?.id ?? "");
  const [kind, setKind] = useState<DemoCoverageKind>("VISIT");
  const [day, setDay] = useState(() => nextDemoDay());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const previewWindow = resolveDemoWindow(day, startTime, endTime);
  const continuityHints = findDemoContinuityHints(visits);
  const [feedback, setFeedback] = useState("");

  const sections: readonly { id: Section; label: string }[] = [
    { id: "episodes", label: "Episodios" },
    { id: "professional-preview", label: "Vista profesional" },
    { id: "patients", label: "Pacientes" },
    { id: "professionals", label: "Profesionales" },
    { id: "assignments", label: "Asignaciones" },
    { id: "reviews", label: "Revisiones" },
  ];

  function changeSection(next: Section) {
    setSection(next);
    setFeedback("");
  }
  function createPatient() {
    if (!onCreatePatient(patientCode)) {
      setFeedback("Código inválido o repetido. Usá de 1 a 4 letras/números ficticios.");
      return;
    }
    setPatientCode("");
    setFeedback("Paciente ficticio incorporado a esta demostración.");
  }
  function createProfessional() {
    if (!onCreateProfessional(professionalCode, specialty)) {
      setFeedback("Código inválido o repetido. Usá identificadores de muestra.");
      return;
    }
    setProfessionalCode("");
    setFeedback("Profesional ficticio incorporado a esta demostración.");
  }
  function assign() {
    if (!previewWindow) {
      setFeedback("Fecha u horario inválidos. Usá AAAA-MM-DD y HH:mm; la cobertura no puede superar 24 h.");
      return;
    }
    if (!onAssign(selectedPatient, selectedProfessional, kind, day, startTime, endTime)) {
      setFeedback("No se pudo simular la cobertura: datos inexistentes o profesional con horario superpuesto.");
      return;
    }
    setFeedback((kind === "SHIFT" ? "Guardia" : "Visita") +
      " ficticia asignada solo en la memoria de la aplicación.");
  }

  return (
    <View style={styles.page}>
      <ScreenHeading
        eyebrow="Coordinación · simulación"
        title="Administración de coberturas"
        subtitle="Programá visitas y guardias ficticias sin cuentas ni datos reales."
      />
      <View style={styles.warning} accessibilityRole="text">
        <Text style={styles.warningTitle}>SOLO DEMOSTRACIÓN · SIN CONEXIÓN A SUPABASE</Text>
        <Text style={styles.warningBody}>
          No escribas nombres, DNI, domicilios ni correos reales. Solo se aceptan códigos ficticios
          breves. Todo se pierde al reiniciar la aplicación.
        </Text>
      </View>

      <View style={styles.sections} accessibilityRole="tablist">
        {sections.map(item => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={"Módulo " + item.label}
            accessibilityState={{ selected: item.id === section }}
            onPress={() => changeSection(item.id)}
            style={[styles.sectionButton, item.id === section && styles.sectionActive]}
          >
            <Text style={[styles.sectionText, item.id === section && styles.sectionTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {section === "patients" && (
        <View style={styles.panel}>
          <Text style={styles.panelHeading}>Alta de pacientes ficticios</Text>
          <Text style={styles.helper}>
            La futura aplicación dará de alta pacientes propios en Supabase. Aquí solo se
            generan etiquetas de muestra, nunca fichas clínicas.
          </Text>
          <TextInput
            accessibilityLabel="Código ficticio del nuevo paciente"
            placeholder="Código (por ejemplo G)"
            placeholderTextColor={palette.textMuted}
            value={patientCode}
            onChangeText={setPatientCode}
            maxLength={4}
            autoCapitalize="characters"
            style={styles.input}
          />
          <PrimaryAction label="Agregar paciente de muestra" onPress={createPatient} />
          <Text style={styles.listTitle}>Directorio simulado · {patients.length}</Text>
          {patients.map(p => (
            <View key={p.id} style={styles.listItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>P</Text>
              </View>
              <Text style={styles.listItemText}>{p.label}</Text>
            </View>
          ))}
        </View>
      )}

      {section === "professionals" && (
        <View style={styles.panel}>
          <Text style={styles.panelHeading}>Alta de profesionales ficticios</Text>
          <Text style={styles.helper}>
            En producción, crear un profesional también requerirá una invitación y una
            cuenta verificable en Supabase Auth. Esta vista no envía invitaciones.
          </Text>
          <TextInput
            accessibilityLabel="Código ficticio del nuevo profesional"
            placeholder="Código (por ejemplo K7)"
            placeholderTextColor={palette.textMuted}
            value={professionalCode}
            onChangeText={setProfessionalCode}
            maxLength={4}
            autoCapitalize="characters"
            style={styles.input}
          />
          <Text style={styles.listTitle}>Especialidad</Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {SPECIALTIES.map(item => (
              <Choice key={item} label={item} selected={specialty === item}
                accessibilityLabel={"Especialidad " + item}
                onPress={() => setSpecialty(item)} />
            ))}
          </View>
          <PrimaryAction label="Agregar profesional de muestra" onPress={createProfessional} />
          <Text style={styles.listTitle}>Profesionales simulados · {professionals.length}</Text>
          {professionals.map(p => (
            <View key={p.id} style={styles.listItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>+</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listItemText}>{p.label}</Text>
                <Text style={styles.listSubtext}>{p.specialty}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {section === "assignments" && (
        <View style={styles.panel}>
          <Text style={styles.panelHeading}>Programar cobertura de muestra</Text>
          <Text style={styles.helper}>
            Elegí la modalidad, la fecha y el horario de inicio y fin. En esta
            demostración cada paciente tiene un episodio ficticio. No se reserva
            ninguna prestación ni se autoriza un plan de cuidados en el servidor.
          </Text>
          <Text style={styles.listTitle}>Paciente</Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {patients.map(p => (
              <Choice key={p.id} label={p.label}
                accessibilityLabel={"Asignar a " + p.label}
                selected={selectedPatient === p.id} onPress={() => setSelectedPatient(p.id)} />
            ))}
          </View>
          <Text style={styles.listTitle}>Profesional</Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {professionals.map(p => (
              <Choice key={p.id} label={p.label + " · " + p.specialty}
                accessibilityLabel={"Seleccionar " + p.label}
                selected={selectedProfessional === p.id}
                onPress={() => setSelectedProfessional(p.id)} />
            ))}
          </View>
          <Text style={styles.listTitle}>Tipo de cobertura</Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            <Choice label="Visita puntual" accessibilityLabel="Modalidad Visita puntual"
              selected={kind === "VISIT"} onPress={() => setKind("VISIT")} />
            <Choice label="Guardia prolongada" accessibilityLabel="Modalidad Guardia prolongada"
              selected={kind === "SHIFT"} onPress={() => setKind("SHIFT")} />
          </View>
          <Text style={styles.listTitle}>Fecha y horario ficticios</Text>
          <TextInput
            accessibilityLabel="Fecha ficticia AAAA-MM-DD"
            placeholder="AAAA-MM-DD"
            placeholderTextColor={palette.textMuted}
            value={day}
            onChangeText={setDay}
            maxLength={10}
            autoCorrect={false}
            style={styles.input}
          />
          <View style={styles.timeRow}>
            <View style={styles.timeColumn}>
              <Text style={styles.listTitle}>Inicio (HH:mm)</Text>
              <TextInput
                accessibilityLabel="Inicio de cobertura HH:mm"
                placeholder="09:00"
                placeholderTextColor={palette.textMuted}
                value={startTime}
                onChangeText={setStartTime}
                maxLength={5}
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            <View style={styles.timeColumn}>
              <Text style={styles.listTitle}>Fin (HH:mm)</Text>
              <TextInput
                accessibilityLabel="Fin de cobertura HH:mm"
                placeholder="10:00"
                placeholderTextColor={palette.textMuted}
                value={endTime}
                onChangeText={setEndTime}
                maxLength={5}
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>
          <View style={styles.noteBox}>
            <Text style={styles.helper}>
              {previewWindow
                ? formatDemoTimeRange(startTime, endTime) + " · " +
                  coverageDurationLabel(previewWindow.durationMinutes) +
                  (previewWindow.overnight ? " · termina al día siguiente" : "")
                : "Fecha u horario inválido · ingresá formato AAAA-MM-DD y HH:mm."}
            </Text>
            <Text style={styles.helper}>
              Esta agenda admite visitas y guardias de duración variable, con
              un máximo técnico de 24 h por cobertura de demostración.
            </Text>
          </View>
          <PrimaryAction label="Simular asignación de cobertura" onPress={assign} />
          <View style={styles.noteBox}>
            <Text style={styles.helper}>Agenda ficticia actual: {visits.length} prestaciones</Text>
          </View>
          {continuityHints.length > 0 ? (
            <View style={styles.continuity}>
              <Text style={styles.continuityTitle}>
                Posibles continuidades de guardia · solo demostración
              </Text>
              <Text style={styles.helper}>
                Estos horarios consecutivos NO prueban comunicación clínica,
                presencia física, relevo realizado ni recepción firmada.
              </Text>
              {continuityHints.map(hint => (
                <Text key={hint.outgoingId + hint.incomingId} style={styles.helper}>
                  {hint.outgoingId} → {hint.incomingId} · mismo episodio ficticio
                </Text>
              ))}
            </View>
          ) : null}
          <PrimaryAction label="Consultar agenda simulada" outline onPress={onOpenAgenda} />
        </View>
      )}

      {section === "episodes" && (
        <View style={styles.panel}>
          <EpisodeOverviewDemo patients={patients} professionals={professionals} visits={visits} />
        </View>
      )}

      {section === "reviews" && (
        <View style={styles.panel}>
          <PlanReviewQueueDemo />
        </View>
      )}

      {section === "professional-preview" && (
        <View style={styles.panel}>
          <ProfessionalRosterPreviewDemo professionals={professionals} visits={visits} />
        </View>
      )}

      {feedback !== "" && (
        <View style={styles.feedback} accessibilityRole="alert">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}
      <Text style={styles.footer}>
        En producción, el acceso a esta pantalla estará restringido a ADMIN o COORDINATOR
        mediante roles de Supabase y verificaciones del servidor.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 900, alignSelf: "center" },
  warning: {
    padding: spacing.lg, borderRadius: corners.medium,
    borderWidth: 1, borderColor: "#EBC08E", backgroundColor: "#FFF7DD",
    gap: spacing.sm, marginBottom: spacing.lg,
  },
  warningTitle: { color: "#92400E", fontWeight: "800", fontSize: 12 },
  warningBody: { color: "#92400E", fontSize: 12, lineHeight: 19 },
  sections: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  sectionButton: {
    minHeight: touchSize, minWidth: 90, justifyContent: "center",
    paddingHorizontal: spacing.md, borderRadius: corners.medium,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  sectionActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  sectionText: { color: palette.textSecondary, textAlign: "center", fontWeight: "700", fontSize: 12 },
  sectionTextActive: { color: palette.surface },
  panel: {
    padding: spacing.lg, borderWidth: 1, borderRadius: corners.large,
    borderColor: palette.border, backgroundColor: palette.surface, gap: spacing.lg,
  },
  panelHeading: { fontSize: 18, fontWeight: "800", color: palette.deep },
  helper: { color: palette.textSecondary, fontSize: 12, lineHeight: 19 },
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  timeColumn: { flex: 1, minWidth: 120, gap: spacing.sm },
  continuity: {
    backgroundColor: palette.primarySubtle, borderWidth: 1,
    borderColor: palette.brandMuted, borderRadius: corners.medium,
    padding: spacing.lg, gap: spacing.sm,
  },
  continuityTitle: { color: palette.deep, fontWeight: "800", fontSize: 13 },
  input: {
    minHeight: touchSize + 3, borderWidth: 1, borderColor: palette.borderStrong,
    color: palette.text, backgroundColor: palette.surface,
    borderRadius: corners.medium, fontSize: 14, paddingHorizontal: spacing.lg,
  },
  listTitle: { fontSize: 12, fontWeight: "800", color: palette.text, marginTop: spacing.xs },
  listItem: { borderBottomWidth: 1, borderBottomColor: palette.border,
    paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: touchSize, height: touchSize, borderRadius: 15,
    backgroundColor: palette.mint, alignItems: "center", justifyContent: "center" },
  avatarText: { color: palette.deep, fontSize: 16, fontWeight: "800" },
  listItemText: { color: palette.text, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  listSubtext: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: {
    minHeight: touchSize, justifyContent: "center", padding: spacing.md,
    borderRadius: corners.medium, borderWidth: 1, borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  choiceSelected: { backgroundColor: palette.primarySubtle, borderColor: palette.primary },
  choiceLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: "600" },
  choiceLabelSelected: { color: palette.primary, fontWeight: "800" },
  noteBox: { borderRadius: corners.medium, backgroundColor: palette.primarySubtle,
    padding: spacing.md },
  feedback: { backgroundColor: palette.mint, padding: spacing.lg,
    borderRadius: corners.medium, marginTop: spacing.md },
  feedbackText: { color: palette.deep, fontSize: 12, fontWeight: "700" },
  footer: { fontSize: 11, lineHeight: 18, color: palette.textMuted, marginTop: spacing.xl },
});

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DemoProfessional } from "./adminDemoData";
import type { DemoVisit } from "./demoData";
import { formatDemoDate, statusLabel } from "./demoData";
import { coverageKindLabel, formatDemoTimeRange } from "./coverageDemo";
import { ScreenHeading } from "./ui";
import {
  demoOwnProfessionalLabel, isDemoProfessional, projectDemoOwnRoster,
} from "./professionalRosterDemo";
import { corners, palette, spacing, touchSize } from "./theme";

/**
 * ROLE DEMO, NOT LOGIN OR AUTHORIZATION. The selector changes a mock
 * professional perspective, never security claims or real patient access.
 */
export function ProfessionalRosterPreviewDemo({
  professionals, visits,
}: {
  professionals: readonly DemoProfessional[];
  visits: readonly DemoVisit[];
}) {
  const [selectedRef, setSelectedRef] = useState(professionals[0]?.id ?? "");
  const choices = professionals.filter((p,index) =>
    isDemoProfessional(p) && professionals.findIndex(item => item.id === p.id) === index
  );
  const selected = choices.find(item => item.id === selectedRef) ?? choices[0];
  const roster = projectDemoOwnRoster(selected, visits);
  const shiftCount = roster.filter(item => item.modality === "SHIFT").length;

  return (
    <View style={styles.root} testID="professional-own-roster-demo">
      <ScreenHeading
        eyebrow="Vista profesional · solo DEMO"
        title="Mi agenda de muestra"
        subtitle="Simulá una agenda personal; nunca refleja sesiones ni permisos reales."
      />
      <View style={styles.warning}>
        <Text style={styles.warningTitle}>SIN AUTENTICACIÓN · NO ES CONTROL DE ACCESO</Text>
        <Text style={styles.help}>
          Cambiar de profesional solo selecciona datos ficticios en memoria.
          En producción el servidor determina identidad, sesión vigente y coberturas propias.
          Ninguna selección de esta pantalla concede acceso clínico.
        </Text>
      </View>
      <Text style={styles.sectionHeading}>Seleccionar profesional ficticio</Text>
      <View style={styles.selector}>
        {choices.map(professional => (
          <Pressable
            key={professional.id}
            accessibilityRole="button"
            accessibilityLabel={"Simular agenda de " + demoOwnProfessionalLabel(professional)}
            accessibilityState={{ selected: selected?.id === professional.id }}
            onPress={() => setSelectedRef(professional.id)}
            style={[styles.selectButton, selected?.id === professional.id && styles.selected]}
          >
            <Text style={[styles.selectText, selected?.id === professional.id && styles.selectedText]}>
              {demoOwnProfessionalLabel(professional)} · {professional.specialty}
            </Text>
          </Pressable>
        ))}
      </View>
      {selected ? (
        <>
          <Text style={styles.sectionHeading}>
            {demoOwnProfessionalLabel(selected)} · {selected.specialty}
          </Text>
          <Text style={styles.help}>
            {roster.length} {roster.length === 1 ? "cobertura" : "coberturas"} de muestra ·
            {" "}{roster.length - shiftCount} visitas · {shiftCount} guardias
          </Text>
          {roster.length ? (
            <View style={styles.list} testID="own-roster-list">
              {roster.map(item => (
                <View key={item.id} style={styles.card} testID={"own-roster-" + item.id}>
                  <Text style={styles.reference}>{item.code}</Text>
                  <Text style={styles.cardTitle}>{item.patientDisplay} · {item.episodeRef}</Text>
                  <Text style={styles.help}>
                    {coverageKindLabel(item.modality)} · {item.specialty}
                  </Text>
                  <Text style={styles.help}>
                    {formatDemoDate(item.date)} · {formatDemoTimeRange(item.startTime,item.endTime)}
                  </Text>
                  <Text style={styles.help}>{statusLabel(item.status)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.help} testID="own-roster-empty">
              Sin coberturas ficticias para esta especialidad y profesional.
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.help} testID="own-roster-no-professionals">
          No hay profesionales ficticios válidos en esta demostración.
        </Text>
      )}
      <Text style={styles.help}>
        No incluye domicilio, nombre real, historia clínica, medicamentos,
        firma ni instrucciones para una prestación sanitaria.
      </Text>
    </View>
  );
}

const styles=StyleSheet.create({
  root:{gap:spacing.md},
  warning:{
    borderColor:"#EBC08E",borderWidth:1,borderRadius:corners.medium,
    backgroundColor:"#FFF7DD",padding:spacing.lg,gap:spacing.sm,
  },
  warningTitle:{fontSize:12,fontWeight:"800",color:"#92400E"},
  sectionHeading:{fontSize:15,fontWeight:"800",color:palette.deep},
  help:{fontSize:12,lineHeight:19,color:palette.textSecondary},
  selector:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  selectButton:{
    minHeight:touchSize,borderWidth:1,borderColor:palette.borderStrong,
    borderRadius:corners.medium,paddingHorizontal:spacing.md,
    paddingVertical:spacing.sm,justifyContent:"center",backgroundColor:palette.surface,
  },
  selected:{borderColor:palette.primary,backgroundColor:palette.primarySubtle},
  selectText:{fontSize:12,color:palette.textSecondary,fontWeight:"700"},
  selectedText:{color:palette.primary},
  list:{gap:spacing.sm},
  card:{
    padding:spacing.md,borderColor:palette.border,borderWidth:1,
    borderRadius:corners.medium,backgroundColor:palette.surface,gap:spacing.xs,
  },
  reference:{fontSize:12,color:palette.primary,fontWeight:"800"},
  cardTitle:{fontSize:14,color:palette.deep,fontWeight:"700"},
});

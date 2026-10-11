import React, { useEffect, useSyncExternalStore } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenHeading } from "./ui";
import { corners, palette, spacing, touchSize } from "./theme";
import type { createCoverageSessionController } from "./coverageSessionController";
import { bindCoverageAuthEvents, type SupabaseLikeAuthEvents } from "./coverageAuthEvents";

type CoverageController = ReturnType<typeof createCoverageSessionController>;

const STATUS_LABELS = Object.freeze({
  PLANNED: "Planificada",
  ASSIGNED: "Asignada",
  ACTIVE: "En curso",
  COMPLETED: "Finalizada",
  CANCELLED: "Cancelada",
  NOT_PERFORMED: "No realizada",
});

/**
 * MOB-DATA-02: explicit, staging-only Edge-read preview. Unmounted from App,
 * because no authorized independent Supabase staging/auth provider exists.
 * No patient details, raw IDs, locations, clinical content or write controls.
 */
export function StagingOwnRosterPreview({ controller, authEvents }: {
  controller: CoverageController;
  authEvents: SupabaseLikeAuthEvents;
}) {
  const current = useSyncExternalStore(
    controller.subscribe, controller.getSnapshot, controller.getSnapshot,
  );

  useEffect(() => {
    // An Auth provider from the independent project is mandatory. The
    // subscription clears stale rows on logout, login and token refresh.
    const unsubscribeAuth = bindCoverageAuthEvents(controller, authEvents);
    const listener = AppState.addEventListener("change", state => {
      if (state !== "active") controller.clear();
    });
    return () => {
      listener.remove();
      unsubscribeAuth();
      // Remove rows and abort pending requests on navigation away.
      controller.clear();
    };
  }, [controller, authEvents]);

  return (
    <View style={styles.root} testID="staging-own-roster-screen">
      <ScreenHeading
        eyebrow="STAGING · sesión independiente"
        title="Mis coberturas de prueba"
        subtitle="Lectura mínima desde Edge, únicamente en un ambiente autorizado."
      />
      <Text style={styles.warning}>
        NO HABILITADO PARA PACIENTES REALES. La identidad la determina
        Supabase Auth y la Edge. Esta pantalla no concede permisos clínicos.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Consultar mis coberturas de prueba"
        disabled={current.state === "loading"}
        style={[styles.button,current.state === "loading" && styles.disabled]}
        onPress={() => { void controller.refresh(); }}
      >
        <Text style={styles.buttonText}>
          {current.state === "loading" ? "Consultando…" : "Consultar mis coberturas de prueba"}
        </Text>
      </Pressable>
      {current.state === "idle" ? (
        <Text testID="staging-roster-idle" style={styles.help}>
          Sin consulta activa. No se conservan coberturas entre sesiones.
        </Text>
      ) : null}
      {current.state === "loading" ? (
        <Text testID="staging-roster-loading" style={styles.help}>
          Verificando la sesión y el acceso a la agenda de prueba…
        </Text>
      ) : null}
      {current.state === "error" ? (
        <Text testID="staging-roster-error" style={styles.help}>
          Consulta no disponible o sesión modificada. No se muestran registros.
        </Text>
      ) : null}
      {current.state === "ready" ? (
        <View style={styles.list} testID="staging-roster-list">
          <Text style={styles.help}>
            {current.rows.length} coberturas de muestra, únicamente metadatos.
          </Text>
          {current.possiblyTruncated ? (
            <Text style={styles.warning} testID="staging-roster-partial">
              La respuesta puede estar incompleta. No se afirma que sea toda la agenda.
            </Text>
          ) : null}
          {current.rows.length === 0 ? (
            <Text style={styles.help} testID="staging-roster-empty">
              El servidor no devolvió coberturas disponibles para esta sesión.
            </Text>
          ) : null}
          {current.rows.map((row,index) => (
            <View key={row.id} style={styles.card} testID={"staging-roster-row-"+index}>
              <Text style={styles.heading}>
                {row.serviceKind === "SHIFT" ? "Guardia" : "Visita"} de prueba {index+1}
              </Text>
              <Text style={styles.help}>Estado: {STATUS_LABELS[row.coverageState]}</Text>
              <Text style={styles.help}>Inicio: {row.scheduledStart}</Text>
              <Text style={styles.help}>Fin: {row.scheduledEnd}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.help}>
        Nunca incluye nombres, direcciones, diagnósticos, órdenes,
        firmas ni datos personales de menores.
      </Text>
    </View>
  );
}

const styles=StyleSheet.create({
  root:{gap:spacing.md},
  warning:{fontSize:12,lineHeight:18,color:"#92400E"},
  help:{fontSize:12,lineHeight:19,color:palette.textSecondary},
  button:{minHeight:touchSize,backgroundColor:palette.primary,
    borderRadius:corners.medium,justifyContent:"center",
    alignItems:"center",padding:spacing.md},
  disabled:{opacity:0.55},
  buttonText:{color:"#FFFFFF",fontSize:13,fontWeight:"700"},
  list:{gap:spacing.sm},
  card:{backgroundColor:palette.surface,borderColor:palette.border,
    borderWidth:1,borderRadius:corners.medium,padding:spacing.md,gap:spacing.xs},
  heading:{fontSize:14,fontWeight:"700",color:palette.deep},
});

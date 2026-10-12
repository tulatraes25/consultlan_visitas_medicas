import React, {useEffect, useState, useSyncExternalStore} from "react";
import {AppState, Pressable, StyleSheet, Text, View} from "react-native";
import {bindCoverageAuthEvents, type SupabaseLikeAuthEvents} from "./coverageAuthEvents";
import type {createAssignedFormSessionController} from "./assignedFormSessionController";
import {isAuthorizedCoverageId} from "./authorizedFormPreviewClient";
import {FormCatalogDemo} from "./FormCatalogDemo";
import {ScreenHeading} from "./ui";
import {corners,palette,spacing,touchSize} from "./theme";

type Controller = ReturnType<typeof createAssignedFormSessionController>;

/**
 * HC-UX-04B2: NON-MOUNTED staging preview. App.tsx does not import this.
 * Auth/coverage/controller identity are bound before ANY prior template can
 * be rendered. Never auto-resolves a coverage, never renders raw UUIDs.
 */
export function StagingAssignedFormPreview({
  controller,authEvents,coverageId,
}:{
  controller:Controller;
  authEvents:SupabaseLikeAuthEvents;
  coverageId:string; // from read-only roster, reauthorized by SQL
}) {
  const validCoverage = isAuthorizedCoverageId(coverageId);
  const [binding,setBinding] = useState<{
    controller:Controller; authEvents:SupabaseLikeAuthEvents; coverageId:string;
  } | null>(null);
  const ready = validCoverage && binding !== null &&
    binding.controller === controller && binding.authEvents === authEvents &&
    binding.coverageId === coverageId;
  const snapshot = useSyncExternalStore(
    controller.subscribe,controller.getSnapshot,controller.getSnapshot,
  );

  useEffect(()=>{
    // Also clear if the selected coverage or injected Auth provider changes.
    controller.clear();
    if (!isAuthorizedCoverageId(coverageId)) {
      setBinding(null);
      return ()=>controller.clear();
    }
    let unlink:()=>void;
    try { unlink=bindCoverageAuthEvents(controller,authEvents); }
    catch {controller.clear();setBinding(null);return ()=>controller.clear();}
    let listener:{remove:()=>void};
    try {
      listener=AppState.addEventListener("change",state=>{
        if(state!=="active")controller.clear();
      });
    } catch {
      unlink();controller.clear();setBinding(null);
      return ()=>controller.clear();
    }
    setBinding({controller,authEvents,coverageId});
    return ()=>{listener.remove();unlink();controller.clear();};
  },[controller,authEvents,coverageId]);

  const loading = ready && snapshot.state === "loading";
  const showForm = ready && snapshot.state === "ready" &&
    snapshot.templateId !== null;

  return (
    <View testID="staging-assigned-form-screen" style={styles.root}>
      <ScreenHeading
        eyebrow="STAGING · SUPABASE INDEPENDIENTE"
        title="Mi planilla de esta prestación"
        subtitle="Un botón para ver únicamente el modelo que corresponde a tu cobertura autorizada."
      />
      <Text style={styles.warning}>
        DEMOSTRACIÓN ESTRUCTURAL. NO HABILITADO PARA PACIENTES REALES.
        No guarda, certifica, firma ni emite documentos.
      </Text>
      {!ready ? (
        <Text testID="assigned-form-binding-blocked" style={styles.warning}>
          Planilla bloqueada hasta vincular una cobertura y sesión de staging válidas.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Consultar mi planilla de prueba"
        disabled={!ready || loading}
        style={[styles.button,(!ready||loading)&&styles.disabled]}
        onPress={()=>{if(ready)void controller.resolve(coverageId);}}
      >
        <Text style={styles.buttonText}>
          {loading?"Verificando mi cobertura…":"Ver mi planilla de prueba"}
        </Text>
      </Pressable>
      {ready&&snapshot.state==="idle" ? (
        <Text testID="assigned-form-idle" style={styles.help}>
          Elegí consultar: el sistema verificará tu sesión y prestación.
        </Text>
      ) : null}
      {loading ? (
        <Text testID="assigned-form-loading" style={styles.help}>
          Comprobando la asignación con el servidor…
        </Text>
      ) : null}
      {ready&&snapshot.state==="error" ? (
        <Text testID="assigned-form-error" style={styles.warning}>
          No se pudo validar esta prestación. No se muestra ninguna planilla.
        </Text>
      ) : null}
      {showForm ? (
        <View testID="assigned-form-focused-preview" style={styles.form}>
          <Text style={styles.help}>
            Solo una vista sin edición: la plantilla llega del servidor,
            no de una especialidad elegida por el celular.
          </Text>
          <FormCatalogDemo key={snapshot.templateId}
            initialTemplateId={snapshot.templateId} focusAssignedTemplate />
          <Pressable accessibilityRole="button"
            accessibilityLabel="Ocultar mi planilla de prueba"
            style={styles.secondary}
            onPress={()=>controller.clear()}>
            <Text style={styles.secondaryText}>Ocultar planilla</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles=StyleSheet.create({
  root:{gap:spacing.md},
  warning:{fontSize:12,lineHeight:19,color:"#92400E"},
  help:{fontSize:12,lineHeight:19,color:palette.textSecondary},
  button:{minHeight:touchSize,backgroundColor:palette.primary,
    borderRadius:corners.medium,justifyContent:"center",
    alignItems:"center",padding:spacing.md},
  buttonText:{fontSize:14,fontWeight:"700",color:"#FFFFFF"},
  disabled:{opacity:0.55},
  secondary:{minHeight:touchSize,backgroundColor:palette.surface,
    borderRadius:corners.medium,borderWidth:1,borderColor:palette.border,
    justifyContent:"center",alignItems:"center",padding:spacing.md},
  secondaryText:{color:palette.deep,fontSize:13,fontWeight:"700"},
  form:{gap:spacing.lg},
});

import React,{useEffect,useState,useSyncExternalStore} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {bindCoverageAuthEvents,type SupabaseLikeAuthEvents} from "./coverageAuthEvents";
import {isCoverageServiceTimeZone,formatCoverageServiceInstant} from "./coverageServiceTime";
import {isCoverageWindow} from "./pagedCoverageClient";
import type {createPagedCoverageController} from "./pagedCoverageController";
import {ScreenHeading} from "./ui";
import {palette,corners,spacing,touchSize} from "./theme";

type Controller=ReturnType<typeof createPagedCoverageController>;
const STATES={
  PLANNED:"Planificada",ASSIGNED:"Asignada",ACTIVE:"En curso",
  COMPLETED:"Finalizada",CANCELLED:"Cancelada",NOT_PERFORMED:"No realizada",
} as const;

/**
 * HC-READ-02B: dormant, explicitly operated staging preview. App.tsx never
 * mounts this screen. Not a clinical roster or proof that care was delivered.
 */
export function StagingPagedRosterPreview({
  controller,authEvents,serviceTimeZone,windowStart,windowEnd,
}:{
  controller:Controller;
  authEvents:SupabaseLikeAuthEvents;
  serviceTimeZone:string;
  windowStart:string; // approved synthetic UTC instant
  windowEnd:string;   // exclusive synthetic UTC instant
}){
  const validZone=isCoverageServiceTimeZone(serviceTimeZone);
  const validWindow=isCoverageWindow({startUtc:windowStart,endUtc:windowEnd});
  // Auth subscription runs in an effect AFTER React's first render; the
  // binding tuple prevents a preloaded roster from being briefly visible.
  const [binding,setBinding]=useState<{
    controller:Controller;authEvents:SupabaseLikeAuthEvents;
    serviceTimeZone:string;windowStart:string;windowEnd:string;
  }|null>(null);
  const ready=validZone&&validWindow&&binding!==null&&
    binding.controller===controller&&binding.authEvents===authEvents&&
    binding.serviceTimeZone===serviceTimeZone&&
    binding.windowStart===windowStart&&binding.windowEnd===windowEnd;
  const current=useSyncExternalStore(
    controller.subscribe,controller.getSnapshot,controller.getSnapshot,
  );

  useEffect(()=>{
    controller.clear();
    if(!isCoverageServiceTimeZone(serviceTimeZone)||
      !isCoverageWindow({startUtc:windowStart,endUtc:windowEnd})){
      setBinding(null);
      return ()=>controller.clear();
    }
    let unlink:()=>void;
    try{unlink=bindCoverageAuthEvents(controller,authEvents);}
    catch{controller.clear();setBinding(null);return ()=>controller.clear();}
    let listener:{remove:()=>void};
    try{
      listener=AppState.addEventListener("change",state=>{
        if(state!=="active")controller.clear();
      });
    }catch{
      unlink();controller.clear();setBinding(null);
      return ()=>controller.clear();
    }
    setBinding({controller,authEvents,serviceTimeZone,windowStart,windowEnd});
    return ()=>{listener.remove();unlink();controller.clear();};
  },[controller,authEvents,serviceTimeZone,windowStart,windowEnd]);

  const loading=ready&&current.state==="loading";
  const canPage=ready&&current.state==="ready"&&current.hasMore&&
    current.rows.length<2000;
  return (
    <View style={styles.root} testID="staging-paged-roster">
      <ScreenHeading
        eyebrow="STAGING · agenda acotada"
        title="Mis coberturas de prueba"
        subtitle="Ventana explícita de datos sintéticos; sin conexión clínica."
      />
      <Text style={styles.warning}>
        NO HABILITADO PARA PACIENTES REALES. Ninguna tarjeta acredita una atención
        ni reemplaza la planificación y confirmación de Coordinación.
      </Text>
      <Text style={styles.help} testID="paged-window">
        {validWindow ? "Ventana UTC: "+windowStart+" hasta "+windowEnd :
          "Ventana temporal inválida: consulta bloqueada."}
      </Text>
      <Text style={styles.help}>
        {validZone ? "Zona del servicio: "+serviceTimeZone :
          "Zona IANA del servicio inválida."}
      </Text>
      {!ready ? (
        <Text testID="paged-auth-blocked" style={styles.warning}>
          Sin proveedor Auth y ventana de staging vinculados. Consulta bloqueada.
        </Text>
      ) : null}
      <Pressable accessibilityRole="button"
        accessibilityLabel="Consultar ventana de prueba"
        disabled={!ready||loading}
        style={[styles.button,(!ready||loading)&&styles.disabled]}
        onPress={()=>{if(ready)void controller.loadWindow({
          startUtc:windowStart,endUtc:windowEnd,
        });}}>
        <Text style={styles.buttonText}>Consultar ventana de prueba</Text>
      </Pressable>
      {loading ? (
        <Text testID="paged-loading" style={styles.help}>
          Verificando sesión y datos de la ventana…
        </Text>
      ) : null}
      {ready&&current.state==="error" ? (
        <Text testID="paged-error" style={styles.warning}>
          Lectura bloqueada o sesión modificada. Los registros fueron descartados.
        </Text>
      ) : null}
      {ready&&current.state==="idle" ? (
        <Text testID="paged-idle" style={styles.help}>
          Sin lectura activa. Las páginas nunca se recuperan automáticamente.
        </Text>
      ) : null}
      {ready&&current.state==="ready" ? (
        <View testID="paged-roster-list" style={styles.list}>
          <Text style={styles.help}>
            {current.rows.length} coberturas ficticias consultadas en esta ventana.
          </Text>
          {current.rows.map((row,index)=>(
            <View key={row.id} style={styles.card} testID={"paged-roster-row-"+index}>
              <Text style={styles.heading}>
                {row.serviceKind==="SHIFT"?"Guardia":"Visita"} de prueba {index+1}
              </Text>
              <Text style={styles.help}>Estado: {STATES[row.coverageState]}</Text>
              <Text style={styles.help}>
                Inicio: {formatCoverageServiceInstant(row.scheduledStart,serviceTimeZone)}
              </Text>
              <Text style={styles.help}>
                Fin: {formatCoverageServiceInstant(row.scheduledEnd,serviceTimeZone)}
              </Text>
            </View>
          ))}
          {current.hasMore ? (
            <Text testID="paged-incomplete" style={styles.warning}>
              Hay otra página de la ventana. La lista es parcial y puede
              modificarse entre consultas; no acredita continuidad asistencial.
            </Text>
          ) : (
            <Text testID="paged-last-page" style={styles.help}>
              Sin más páginas en esta consulta. No garantiza cobertura
              clínica completa ni ausencia de cambios posteriores.
            </Text>
          )}
          {current.hasMore&&current.rows.length>=2000 ? (
            <Text style={styles.warning} testID="paged-memory-cap">
              Se alcanzó el límite de visualización; elegí una ventana menor.
            </Text>
          ) : null}
          {canPage ? (
            <Pressable accessibilityRole="button"
              accessibilityLabel="Cargar siguiente página de prueba"
              onPress={()=>{void controller.loadNext();}}
              style={styles.button} testID="paged-next">
              <Text style={styles.buttonText}>Cargar siguiente página de prueba</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.help}>
        Sin nombres, documentos, diagnósticos, indicaciones, contactos ni firmas.
      </Text>
    </View>
  );
}

const styles=StyleSheet.create({
  root:{gap:spacing.md},
  warning:{fontSize:12,lineHeight:18,color:"#92400E"},
  help:{fontSize:12,lineHeight:19,color:palette.textSecondary},
  button:{minHeight:touchSize,backgroundColor:palette.primary,
    borderRadius:corners.medium,justifyContent:"center",alignItems:"center",
    padding:spacing.md},
  disabled:{opacity:0.55},
  buttonText:{color:"#FFFFFF",fontSize:13,fontWeight:"700"},
  list:{gap:spacing.sm},
  card:{backgroundColor:palette.surface,borderColor:palette.border,
    borderWidth:1,borderRadius:corners.medium,padding:spacing.md,gap:spacing.xs},
  heading:{fontSize:14,fontWeight:"700",color:palette.deep},
});

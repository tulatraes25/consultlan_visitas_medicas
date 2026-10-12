import React,{useEffect,useState,useSyncExternalStore} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {StagingPagedRosterPreview} from "./StagingPagedRosterPreview";
import {StagingAssignedFormPreview} from "./StagingAssignedFormPreview";
import type {createPagedCoverageController,PagedRosterSnapshot} from "./pagedCoverageController";
import type {createAssignedFormSessionController} from "./assignedFormSessionController";
import type {SupabaseLikeAuthEvents} from "./coverageAuthEvents";
import {corners,palette,spacing,touchSize} from "./theme";

type RosterController=ReturnType<typeof createPagedCoverageController>;
type FormController=ReturnType<typeof createAssignedFormSessionController>;
type Selection=Readonly<{
  coverageId:string;
  rosterSnapshot:PagedRosterSnapshot;
  rosterController:RosterController;
  formController:FormController;
  authEvents:SupabaseLikeAuthEvents;
  serviceTimeZone:string;
  windowStart:string;
  windowEnd:string;
}>;

/**
 * HC-UX-04B5: OFFLINE-TESTED STAGING COMPOSITION, NOT MOUNTED IN App.tsx.
 * Two separately server-authorized reads are chained ONLY after a deliberate
 * press on a coverage obtained in the latest own-roster snapshot.
 *
 * Snapshot identity (not merely coverage UUID) is the selection capability.
 * When Auth, window, timezone, controller, or pagination changes, the prior
 * capability is invalid before React can render a previously selected form.
 * This does NOT grant access: Edge/RPC rechecks the actor and session.
 */
export function StagingProfessionalFlowPreview({
  rosterController,formController,authEvents,serviceTimeZone,windowStart,windowEnd,
}:{
  rosterController:RosterController;
  formController:FormController;
  authEvents:SupabaseLikeAuthEvents;
  serviceTimeZone:string;
  windowStart:string;
  windowEnd:string;
}){
  const roster=useSyncExternalStore(
    rosterController.subscribe,rosterController.getSnapshot,rosterController.getSnapshot,
  );
  const [selection,setSelection]=useState<Selection|null>(null);
  const active=selection!==null&&
    selection.rosterController===rosterController&&
    selection.formController===formController&&
    selection.authEvents===authEvents&&
    selection.serviceTimeZone===serviceTimeZone&&
    selection.windowStart===windowStart&&
    selection.windowEnd===windowEnd&&
    selection.rosterSnapshot===roster&&roster.state==="ready"&&
    roster.rows.some(row=>row.id===selection.coverageId);

  // Form metadata never survives a lost selection or leaving this staging flow.
  useEffect(()=>{
    if(!active)formController.clear();
  },[active,formController]);
  useEffect(()=>()=>{formController.clear();},[formController]);

  const choose=(coverageId:string)=>{
    const current=rosterController.getSnapshot();
    if(current.state!=="ready"||
      !current.rows.some(row=>row.id===coverageId))return;
    formController.clear();
    setSelection({
      coverageId,rosterSnapshot:current,rosterController,formController,
      authEvents,serviceTimeZone,windowStart,windowEnd,
    });
  };
  const close=()=>{
    // Clear synchronously before unmount to prevent an old form flash.
    formController.clear();
    setSelection(null);
  };
  return (
    <View style={styles.root} testID="staging-professional-flow">
      <Text style={styles.notice}>
        CIRCUITO DE PRUEBA · DATOS FICTICIOS · NO HABILITADO PARA PACIENTES.
        Nunca guarda ni firma documentos.
      </Text>
      <View style={active?styles.hidden:undefined}
        importantForAccessibility={active?"no-hide-descendants":"auto"}>
        <StagingPagedRosterPreview controller={rosterController}
          authEvents={authEvents} serviceTimeZone={serviceTimeZone}
          windowStart={windowStart} windowEnd={windowEnd}
          onSelectCoverage={choose}/>
      </View>
      {active&&selection ? (
        <View style={styles.form} testID="staging-professional-form-flow">
          <Pressable accessibilityRole="button"
            accessibilityLabel="Volver a mis coberturas de prueba"
            onPress={close} style={styles.back}>
            <Text style={styles.backText}>← Volver a mis coberturas</Text>
          </Pressable>
          <StagingAssignedFormPreview key={selection.coverageId}
            controller={formController} authEvents={authEvents}
            coverageId={selection.coverageId}/>
        </View>
      ):null}
    </View>
  );
}

const styles=StyleSheet.create({
  root:{gap:spacing.md},
  notice:{color:"#92400E",fontSize:12,lineHeight:19},
  hidden:{display:"none"},
  form:{gap:spacing.md},
  back:{minHeight:touchSize,borderRadius:corners.medium,
    borderWidth:1,borderColor:palette.border,padding:spacing.md,
    justifyContent:"center",backgroundColor:palette.surface},
  backText:{fontSize:14,fontWeight:"700",color:palette.deep},
});

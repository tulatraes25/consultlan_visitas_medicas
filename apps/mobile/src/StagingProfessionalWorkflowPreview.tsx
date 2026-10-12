import React,{useEffect,useMemo,useState,useSyncExternalStore} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {createPagedCoverageController} from "./pagedCoverageController";
import {createAssignedFormSessionController} from "./assignedFormSessionController";
import {StagingPagedRosterPreview} from "./StagingPagedRosterPreview";
import {StagingAssignedFormPreview} from "./StagingAssignedFormPreview";
import {isCoverageWindow} from "./pagedCoverageClient";
import {isCoverageServiceTimeZone} from "./coverageServiceTime";
import type {ReadOnlyCoverageConfig} from "./readonlyCoverageClient";
import type {SupabaseLikeAuthEvents} from "./coverageAuthEvents";
import {palette,corners,spacing,touchSize} from "./theme";

/**
 * HC-UX-04C: dormant staging-only composition of two independently
 * reauthorized readers. NEVER import this into App.tsx until isolated staging
 * has passed remote two-tenant/session-revocation verification.
 *
 * One locked config constructs both readers: no possibility of injecting a
 * different Supabase project for the roster and its selected form.
 */
export function StagingProfessionalWorkflowPreview({
  config,authEvents,serviceTimeZone,windowStart,windowEnd,
}:{
  config:ReadOnlyCoverageConfig;
  authEvents:SupabaseLikeAuthEvents;
  serviceTimeZone:string;
  windowStart:string;
  windowEnd:string;
}){
  const pair=useMemo(()=>Object.freeze({
    roster:createPagedCoverageController(config),
    form:createAssignedFormSessionController(config),
  }),[config]);
  const roster=useSyncExternalStore(
    pair.roster.subscribe,pair.roster.getSnapshot,pair.roster.getSnapshot,
  );
  const [selected,setSelected]=useState<string|null>(null);
  const [binding,setBinding]=useState<{
    pair:typeof pair;
    authEvents:SupabaseLikeAuthEvents;
    serviceTimeZone:string;
    windowStart:string;
    windowEnd:string;
  }|null>(null);
  const ready=isCoverageWindow({startUtc:windowStart,endUtc:windowEnd})&&
    isCoverageServiceTimeZone(serviceTimeZone)&&binding!==null&&
    binding.pair===pair&&binding.authEvents===authEvents&&
    binding.serviceTimeZone===serviceTimeZone&&
    binding.windowStart===windowStart&&binding.windowEnd===windowEnd;

  useEffect(()=>()=>{pair.roster.dispose();pair.form.dispose();},[pair]);

  useEffect(()=>{
    // First render against changed context cannot display a previous choice.
    pair.roster.clear();
    pair.form.clear();
    setSelected(null);
    setBinding({pair,authEvents,serviceTimeZone,windowStart,windowEnd});
    return ()=>{pair.roster.clear();pair.form.clear();};
  },[pair,authEvents,serviceTimeZone,windowStart,windowEnd]);

  useEffect(()=>{
    // Auth events, paging and session revocation make the old selection stale.
    // This listener runs on the synchronous controller snapshot transition.
    return pair.roster.subscribe(snapshot=>{
      if(snapshot.state!=="ready"){
        pair.form.clear();
        setSelected(null);
      }
    });
  },[pair]);

  const selectedFromCurrentPage=selected!==null&&ready&&
    roster.state==="ready"&&roster.rows.some(row=>row.id===selected);
  const selectCoverage=(coverageId:string)=>{
    // Guard even if a button's event arrived after a roster switch.
    const current=pair.roster.getSnapshot();
    if(!ready||current.state!=="ready"||
      !current.rows.some(row=>row.id===coverageId)){
      pair.form.clear();
      setSelected(null);
      return;
    }
    // Never carry a template over from the preceding selected coverage.
    pair.form.clear();
    setSelected(coverageId);
  };

  return <View testID="staging-professional-workflow" style={styles.root}>
    <Text style={styles.notice}>
      DEMOSTRACIÓN DE STAGING · Sin historias clínicas, pacientes reales,
      aprobaciones, firmas ni guardado. Cada planilla se verifica otra vez
      con la sesión y cobertura en el servidor.
    </Text>
    <StagingPagedRosterPreview controller={pair.roster}
      authEvents={authEvents} serviceTimeZone={serviceTimeZone}
      windowStart={windowStart} windowEnd={windowEnd}
      onSelectCoverage={selectCoverage}/>
    {selectedFromCurrentPage&&selected ? (
      <View testID="staging-workflow-selected" style={styles.selected}>
        <Pressable accessibilityRole="button"
          accessibilityLabel="Volver a mis coberturas de prueba"
          onPress={()=>{pair.form.clear();setSelected(null);}}
          style={styles.back}>
          <Text style={styles.backText}>← Volver a mis coberturas</Text>
        </Pressable>
        <StagingAssignedFormPreview controller={pair.form}
          authEvents={authEvents} coverageId={selected}/>
      </View>
    ) : (
      <Text testID="staging-workflow-no-selection" style={styles.help}>
        Consultá tu agenda y elegí una cobertura autorizada para ver su
        planilla de prueba. Ninguna planilla se abre automáticamente.
      </Text>
    )}
  </View>;
}

const styles=StyleSheet.create({
  root:{gap:spacing.lg},
  notice:{fontSize:12,lineHeight:19,color:"#92400E"},
  help:{fontSize:12,lineHeight:19,color:palette.textSecondary},
  selected:{gap:spacing.md,borderTopWidth:1,
    borderTopColor:palette.border,paddingTop:spacing.md},
  back:{minHeight:touchSize,backgroundColor:palette.surface,
    borderRadius:corners.medium,borderWidth:1,borderColor:palette.border,
    justifyContent:"center",alignItems:"center",padding:spacing.sm},
  backText:{fontSize:13,fontWeight:"700",color:palette.deep},
});

/**
 * MOB-TIME-01: presentation ONLY of already-validated Edge coverage instants.
 * The organization must explicitly provide its IANA service timezone.
 * Timezone changes cannot alter server timestamps, assignments or access.
 */
const ZONE_ID=/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/;

function formatter(timeZone:string){
  return new Intl.DateTimeFormat("es-AR",{
    timeZone,year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23",
    timeZoneName:"shortOffset",
  });
}

export function isCoverageServiceTimeZone(timeZone:unknown):timeZone is string {
  if(typeof timeZone!=="string"||timeZone.length>80||!ZONE_ID.test(timeZone))return false;
  try{
    // Verify the runtime can supply an explicit UTC offset, needed to
    // distinguish repeated local clock times during a DST fall-back.
    const offset=formatter(timeZone).formatToParts(new Date(0))
      .find(part=>part.type==="timeZoneName")?.value;
    return typeof offset==="string" && /^(?:GMT|UTC)(?:[+-]\d{1,2}(?::\d{2})?)?$/.test(offset);
  }catch{return false;}
}

/** Keep the explicit offset next to every clock time, even on DST transitions. */
export function formatCoverageServiceInstant(instant:string,timeZone:string):string {
  if(!isCoverageServiceTimeZone(timeZone))throw new Error("ROSTER_TIME_ZONE_REQUIRED");
  const date=new Date(instant);
  if(!Number.isFinite(date.getTime()))throw new Error("ROSTER_TIME_INVALID");
  const value=formatter(timeZone).format(date);
  if(!/(?:GMT|UTC)(?:[+-]\d{1,2}(?::\d{2})?)?$/.test(value)){
    throw new Error("ROSTER_TIME_OFFSET_UNAVAILABLE");
  }
  return value;
}

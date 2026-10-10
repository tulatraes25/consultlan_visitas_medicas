# HC-02C — Autorización clínica y aprobación de planes
**Estado:** SPEC/Kiro, contrato de diseño sin habilitación clínica. Solo datos sintéticos. Supabase autónomo, sin pacientes ambulatorios ni servidor CONSULTLAN.

## Objetivo
Impedir que administración, coordinación o un profesional sin habilitación válida apruebe planes, active episodios o suplante decisiones de Dirección Médica.

## Requisitos
R1. Separación de roles ADMIN/COORDINATOR y CLINICAL_APPROVER. Ningún rol logístico aprueba unilateralmente; verificar identidad humana, matrícula/habilitación vigente, competencia, membresía y vinculación al episodio según protocolo institucional.
R2. Aprobación atada a versión canónica inmutable del plan, digest de contenido, actor autenticado y hora confiable del servidor. Cambios requieren versión nueva y autorización nueva; nada de booleanos editables.
R3. Máquina de estados DRAFT -> PENDING_CLINICAL_REVIEW -> ACTIVE, con REJECTED, SUSPENDED y egreso diferenciado. No permitir ACTIVE sin aprobación vigente, equipo mínimo clínicamente autorizado y comprobación de consentimiento/representación que corresponda.
R4. Operaciones de escritura exclusivamente mediante Edge Function autenticada y RPC restringidas con auditoría, idempotencia, locks transaccionales, control de versión y revalidación de permisos. Actor desde token validado en servidor, nunca aportado por cliente.
R5. Profesional revocado, plan expirado, rechazo, evidencia ausente, conflicto de representación o conexión interrumpida: denegar transición. No simular emergencia clínica ni consentimiento sanitario.
R6. Protección de menores y datos sensibles, con limitación de acceso por episodio, mínima retención técnica, cifrado, política de resguardo y nunca incluir historia clínica en logs.
R7. Relevo y cobertura mantienen invariantes HC-02A/B: ninguna planificación nueva si episodio suspendido, profesional fuera de equipo, plan no aprobado o rango temporal inválido.
R8. Firma táctil es solo demo sin validez legal; aprobación clínica, firma electrónica y firma digital son procesos distintos, sujetos a validación legal y de Dirección Médica.

## Pruebas negativas obligatorias
1. Administración, coordinador, profesional no habilitado, revocado, de otra organización o episodio: DENY para aprobar/activar.
2. Carrera de aprobaciones, reenvíos y revisión de payload: no duplicar; rechazar aprobación de versión obsoleta.
3. Plan en DRAFT o vencido, equipo incompleto o consentimiento no acreditado: no ACTIVE.
4. Suspensión revoca actos futuros, sin borrar auditoría anterior.
5. Frontend no puede invocar RPC privilegiada ni fingir identidad del actor; RLS y Edge rechazan bypass.
6. Cobertura VISIT/SHIFT sigue validando superposición, profesional, vigencia de inicio y fin.
7. Sin pacientes reales, tokens privados, firmas verdaderas ni tratamientos inventados en fixtures.
8. Certificación de PostgreSQL, Deno, dominio y export Android/iOS por PR y CI SHA exacto.

## Decisiones bloqueantes
CLIN-01 Dirección Médica: quién aprueba cada modalidad de cuidado, qué versión de plan, equipo mínimo, admisión, suspensión, egreso y excepciones.
LEGAL-01 Legal/privacidad: representación de menores, consentimiento, validez del acto, retención y evidencia.
SEC-01 Seguridad: autenticación de aprobadores, revocación, bitácora, backups y seguridad de dispositivos.
OPS-01 Administración: separación funcional, excepción y procedimiento de auditoría.
SRC-01 Validación del expediente y planillas provistas por Pediatrics.

## Plan por gates
**HC-02C1:** contratos, esquema de autorizaciones y pruebas negativas sin acciones de aprobación habilitadas; solo trabajo sintético.
**HC-02C2:** actos operativos y activación solo luego de aprobación formal multidisciplinaria, seguridad real del Supabase autónomo y validación clínica.

No convertir resultados de CI o demostraciones en autorización para pacientes. Ni el estado ACTIVE ni la firma de un adulto se aceptan sin validación del circuito.

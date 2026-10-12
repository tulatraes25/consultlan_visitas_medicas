# SEC-EGRESS-01 — Contratos de salida para RPC administrativas

**SPEC/Kiro · 2026-10-12 · backend Supabase aún desconectado · no uso clínico**

## Hallazgo
El handler Edge verificaba el JWT, la sesión activa, las acciones permitidas y los campos de solicitud. Para las lecturas de agenda, planilla y alcance de episodio ya rechazaba respuestas SQL que agregaran metadatos. Sin embargo, las operaciones administrativas restantes reflejaban cualquier `result.data` exitoso de `service_role` al cliente. Un cambio SQL accidental podría exponer nombres, diagnósticos, notas o firmas incluso en una acción de borrador.

## Contrato cerrado de salida

| Resultado SQL exacto | RPC permitidas |
|---|---|
| UUID (string) | `api_create_patient`, `api_register_professional`, `api_hc_create_episode_draft`, `api_hc_request_plan_review`, `api_hc_schedule_coverage`, `api_hc_request_handover` |
| Entero seguro de versión 1..1.000.000 | `api_hc_create_plan_draft` |
| NULL / VOID | `api_hc_assign_team_member`, `api_hc_ack_handover` |
| Array `[]` o un episodio con dos claves | `api_hc_episode_scope` (SEC-READ-03) |
| Página de metadatos autorizados | `api_hc_list_my_coverages_page` (HC-READ-04) |
| Plantilla de estructura acotada a seis tipos | `api_hc_resolve_my_attendance_template` (HC-UX-04B1) |

**Por defecto, cualquier RPC nueva o respuesta malformada se rechaza.** Las respuestas de error son únicamente HTTP 502 con `{"error":"DATA_OPERATION_FAILED"}`; nunca se devuelven los datos del SQL que fallaron el control.

## Verificación
- Deno prueba respuestas válidas para nueve RPC administrativas y las tres lecturas estrictas.
- Para cada operación administrativa rechaza valores de otros tipos, arreglos, documentos, atributos de paciente, firmas y narrativas agregadas; pruebas negativas no reflejan los valores upstream ni los secretos de Auth.
- La sesión activa y la identidad del actor siguen validadas antes del RPC. Las denegaciones SQL y el tratamiento de conflictos se mantienen.
- Deben aprobar cinco trabajos de GitHub Actions, fusionarse con merge normal y comprobarse el CI posterior al merge.

## Límites y próxima dependencia
No se añaden endpoints, tablas, migraciones, formularios editables, firmas ni autorizaciones médicas. `createPatient` y `registerProfessional` siguen siendo comandos administrativos protegidos, no registro abierto para pacientes reales. Se exige staging Supabase autónomo, pruebas remotas sintéticas, cotejo privado de planillas y revisión institucional antes de salir del estado **NO-GO**.

# SUPA-04B — Revocación de ejecución para RPC clínicas de prototipo

**SPEC/Kiro — Seguridad del backend.** Proyecto de internación domiciliaria pediátrica independiente. Solo fixtures sintéticos; sin Supabase cloud ni atención real.

## Objetivo
Completar la defensa en profundidad iniciada en SUPA-04. No basta con retirar una ruta del allowlist de la Edge: se debe eliminar también el permiso de ejecución del rol de backend sobre funciones clínicas antiguas ajenas al circuito de autorización médica aún pendiente.

## Requisitos
R1. Revocar EXECUTE de service_role para cinco RPC históricas: api_schedule_visit, api_begin_visit, api_add_clinical_note, api_submit_visit_review, api_cancel_visit.
R2. Preservar el rechazo ya existente a anon y authenticated. Ningún usuario de dispositivo obtiene permisos nuevos.
R3. Mantener temporalmente definiciones de RPC históricas para regresiones SQL SUPA-02; la revocación se aplica **después** de esos tests y de HC-02C1B.
R4. Las funciones administrativas api_create_patient, api_register_professional y la solicitud PENDING api_hc_request_plan_review conservan EXECUTE backend según sus políticas originales; no equivale a acreditación clínica.
R5. Probar las ACL con PostgreSQL real y realizar al menos una invocación como service_role denegada por insuficiencia de privilegios.
R6. No hacer DROP ni alteraciones de datos, pacientes, firmas, historias, planes, órdenes, episodios o visitas reales. Sin conexión a CONSULTLAN.

## Implementación
- `supabase/migrations/20261010060000_revoke_legacy_clinical_rpc.sql`: REVOKE explícitos y comentarios sobre el contrato retirado.
- `supabase/tests/revoke_legacy_clinical_rpc.sql`: verificación de roles y rutas administrativas sobrevivientes.
- Quality Gate: aplicar migración y ejecutar test después de HC-02C1B, sin romper regresiones históricas.
- Referencia a SUPA-04: `docs/specs/SUPA-04-legacy-clinical-route-lockdown.md`.

## Condiciones de aceptación
- Las cinco funciones presentan has_function_privilege(...,EXECUTE)=false para service_role, authenticated y anon.
- Una llamada direct SQL como service_role falla con insufficient_privilege.
- Alta administrativa autorizada y solicitud pendiente conservan permisos, siempre validadas por su propio circuito.
- CI completo (Node, Deno, PostgreSQL y Expo Android/iOS) sobre head exacto, auditoría del diff, merge normal y comprobación post-main.

## Riesgos residuales
Una clave service_role robada puede alcanzar otras operaciones permitidas; sigue siendo crítico mantenerla exclusivamente en Edge, rotarla y no entregarla al dispositivo. El rol propietario postgres mantiene privilegios de migración. No hay equipo médico verificado, consentimientos, plan clínico versionado real ni despliegue Supabase. El producto sigue bloqueado para pacientes.

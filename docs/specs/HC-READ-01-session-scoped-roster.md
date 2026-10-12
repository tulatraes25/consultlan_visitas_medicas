# HC-READ-01 — Lectura mínima de coberturas por profesional y sesión activa

**SPEC/Kiro · 2026-10-10 · Implementación GitHub con datos sintéticos, NO desplegada.**

**HISTÓRICO / RUTA EDGE RETIRADA POR HC-READ-03.** La función SQL original se mantiene para preservar el historial de migraciones, pero la operación `listMyHomecareCoverages` ya no está permitida en Edge porque el límite global de las primeras cien coberturas puede ocultar asignaciones futuras. El cliente nuevo debe utilizar únicamente HC-READ-02 por ventana/cursor. Los párrafos siguientes documentan las decisiones de la fase original, no un endpoint vigente.
Aplicación exclusiva de internación domiciliaria pediátrica, con Supabase autónomo. No se utilizan pacientes ambulatorios, secretos de producción, expedientes ni firmas.

## Problema y hallazgo de seguridad
En HC-02A, `authenticated` recibió SELECT directo sobre `homecare_coverage_assignments` y `homecare_shift_handovers` para probar las políticas RLS. La revocación de `auth.sessions` puede ser anterior al vencimiento de un JWT de acceso: un GET directo a PostgREST podría eludir el gate extra de sesión activa de Edge. El adaptador móvil MOB-DATA-01 ya se había diseñado para no usar PostgREST; faltaba cerrar el SQL y autorizar la ruta del servidor.

## Requisitos obligatorios
1. Revocar SELECT directo en ambas tablas a `public`, `anon`, `authenticated`. Mantener RLS existente para reglas internas y pruebas históricas, pero no dar por vigente ni suficiente el control de sesión en RLS.
2. Incorporar `public.api_hc_list_my_coverages(p_actor uuid)` exclusivamente con EXECUTE de `service_role`, `SECURITY DEFINER`, `search_path=''`, SQL cualificado y permiso de lectura **expreso** por profesional, membresía, equipo de episodio y organización (sin confiar en RLS porque service_role la omite).
3. El actor se deriva de `/auth/v1/user` tras verificar el JWT y se contrasta con `auth.sessions` mediante el gate preexistente SEC-SESSION-01/02, antes de llegar al handler. No se acepta `p_actor`, `organizationId`, `patientId`, `episodeId`, rol, especialidad o parámetros SQL desde el móvil.
4. Solo un profesional con `professionals.active`, `memberships.active`, rol `PROFESSIONAL` y `organizations.active`, efectivamente asignado en `homecare_care_team.active`, puede leer **sus propias** coberturas en episodios `ACTIVE` o `SUSPENDED`. Coordinadores y administradores requieren un futuro endpoint distinto; auditores no acceden.
5. Proyección estricta de seis atributos: `id`, `episode_id`, `service_kind`, `coverage_state`, `scheduled_start` y `scheduled_end`. Sin identificadores de paciente ni profesional, nombres, diagnósticos, evolución, medicación, direcciones, contactos, órdenes o firmas. Máximo 100 filas, ordenadas por hora inicial e ID; la página puede quedar truncada.
6. Resultado SQL JSONB arreglo; Edge devuelve `{ok:true,result:[...]}` con `cache-control:no-store`. Sin filas propias, retorna `[]` solo si la identidad tiene condición profesional activa; identidad sin permisos → 403. 401/503 para sesión ausente/servicio Auth caído. No se registran cargas clínicas en CI ni en logs.
7. Sin mutaciones, altas, registros médicos, autorizaciones de un plan, aprobaciones, ni despliegues automáticos. No conectar el adaptador móvil a la pantalla antes de que el proyecto staging Supabase independiente cumpla los gates 01A/01B/01C.

## Diseño / archivos
- `supabase/migrations/20261010080000_homecare_roster_edge_read.sql`: RPC de consulta restringida y cierre de SELECT directo en coberturas/relevos.
- `supabase/functions/visits/handler.ts`: **antiguamente** exponía `listMyHomecareCoverages` sin argumentos; la ruta fue retirada en HC-READ-03. Se conservan exclusivamente las acciones paginadas del nuevo contrato.
- `supabase/tests/homecare_roster_edge_read.sql`: prueba real PostgreSQL 16, fixtures inventados de las migraciones anteriores, grants, aislamiento por organización y pertenencia, rol y revocaciones.
- `supabase/functions/visits/authentication.test.ts`: prueba Deno de secuencia Auth→sesión activa→RPC, bloqueo ante JWT revocado y campos de actor/organización falsificados.
- `apps/mobile/src/readonlyCoverageClient.ts`: contrato previo permanece desconectado; HTTP 422 ya no significa función ausente sino operación rechazada.
- `.github/workflows/quality-gate.yml`: aplicación y test de la novena migración luego del control de sesión; Node, Deno, PostgreSQL, React Native + Expo JS Android/iOS.

## Verificación / criterios de aceptación
- Función SQL de EXECUTE exclusivo `service_role`; acceso directo a las dos tablas rechazado para `authenticated` y `anon`, incluso con sub sintético válido.
- Profesional A solo ve coberturas A, B no ve A, profesional de otro tenant no ve A/B; no se presentan notas, paciente ni claves extra.
- Administrador, coordinador, auditor, actor inexistente o nulo → RPC denegada. Membresía revocada, profesional inactivo, organización inactiva o equipo desasignado → acceso denegado o vacío según corresponda.
- Edge rechaza sesión cerrada, identidad incorrecta, SQL no autorizado, cuerpo con rol/actor/org/episodio, o caída de autenticación.
- Comprobar four-job PR CI en SHA exacto y merge normal; posmerge CI solo puede certificarse con verificación real, no por suposición.

## Actualización posterior — SEC-READ-02A

La migración posterior SEC-READ-02A revoca SELECT de otras once tablas sensibles para JWT de cliente. El único SELECT remoto mantenido para `authenticated` es `homecare_episodes` con RLS, necesario para STAGING-01B sintético; **SEC-READ-02B elimina ese SELECT y sustituye STAGING-01B por un verificador Edge de dos campos; sigue pendiente validación real contra Supabase**. [SPEC SEC-READ-02A](SEC-READ-02A-sensitive-table-lockdown.md).

## Riesgos residuales / NO-GO
Aún subsisten otras tablas con SELECT directo para `authenticated` (pacientes, episodios, visitas, notas y metadatos de planes). Por tanto el cierre de **estas dos tablas** no certifica revocación inmediata para todas las vistas clínicas. Requieren inventario, política de lectura equivalente por Edge y revocación deliberada en un gate posterior **SEC-READ-02** antes de cualquier paciente verdadero.

El nuevo RPC verifica autorización de acceso a la agenda, no credenciales profesionales reales, vigencia del plan clínico, efectividad de una prestación o aprobación médica. El proyecto Supabase real no existe/despliega desde este gate; también falta verificar semántica de `auth.sessions`, MFA, backups, restauración, Storage, protección legal de menores y responsabilidades clínicas institucionales. Las pruebas locales no equivalen a autorización sanitaria.

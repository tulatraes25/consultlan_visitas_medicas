# Supabase independiente — SUPA-01/02/03, HC-01, HC-02A y HC-02B

**Estado:** migraciones SUPA-01/02 y HC-01 con RLS, comandos backend-only de prototipo y pruebas en PostgreSQL; Edge SUPA-03 desarrollada por separado. Sin proyecto Supabase real instalado.
**Decisión:** [ADR-002](../docs/adr/ADR-002-supabase-autonomo.md). **Prohibida** la conexión con el servidor de Pediatrics/CONSULTLAN.

## Modelo inicial
La migración `migrations/20261010000000_standalone_foundation.sql` crea:
- `organizations` y `memberships`: acceso propio con perfiles ADMIN, COORDINATOR, PROFESSIONAL, AUDITOR.
- `professionals`: profesional activo asociado a `auth.users.id` de **este** Supabase.
- `patients`: directorio propio, sin identificadores importados.
- `visits`: visitas asignadas, identificadores UUID, pertenencia de paciente/profesional a misma organización y estados permitidos.
- `clinical_records`: notas separadas, legibles solo por profesional activo asignado.
- `attendance_evidence`: metadatos de conformidad (no imagen cruda ni firma digital).
- `audit_events`: eventos para ADMIN/AUDITOR, sin narrativas clínicas.

Los roles funcionales se guardan en la base (membership); el cliente nunca puede editarlos ni atribuirse privilegios a partir de `user_metadata`. Los nombres de especialidades no elevan permisos.

**Las 14 tablas públicas de la aplicación conservan RLS y no conceden SELECT ni escrituras directas a `authenticated`/`anon`, después de HC-READ-01 y SEC-READ-02A/B.** Las lecturas mínimas autorizadas pasan exclusivamente por Edge con Auth y verificación de sesión vigente. SEC-SURFACE-01 rechaza nuevas exposiciones a medida que se añadan migraciones. Los comandos de cambio clínico permanecen bloqueados; no hay autorización clínica ni pacientes reales. La identidad y los roles se comprueban del lado del servidor, nunca desde datos del móvil.

## Prueba local sin Supabase
En GitHub CI se inicia un servicio `postgres:16-alpine` sin datos externos:
```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/postgres_auth_stub.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010000000_standalone_foundation.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010010000_operational_commands.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/operational_commands.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010020000_homecare_episodes.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/homecare_episode_isolation.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010030000_homecare_coverage.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/homecare_coverage_handover.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010040000_homecare_controlled_commands.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/homecare_controlled_commands.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010050000_homecare_review_requests.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/homecare_plan_review_requests.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010060000_revoke_legacy_clinical_rpc.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/revoke_legacy_clinical_rpc.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010070000_live_auth_session_gate.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/live_auth_session_gate.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010080000_homecare_roster_edge_read.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/homecare_roster_edge_read.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010090000_close_direct_sensitive_reads.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/close_direct_sensitive_reads.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010100000_episode_scope_edge_read.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/episode_scope_edge_read.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/dynamic_public_surface_guard.sql
psql -v ON_ERROR_STOP=1 -f supabase/staging/01d_catalog_readonly_attestation.sql
```
El stub `postgres_auth_stub.sql` simula exclusivamente el esquema de autenticación y roles de Supabase dentro del Postgres de CI. **No debe ejecutarse en Supabase real.**

Se prueban usuarios asignados y no asignados, aislamiento entre organizaciones, lectura administrativa sin notas clínicas, auditoría separada, usuarios inactivos, usuarios anónimos, mutaciones directas rechazadas, integridad referencial y revocación de membresía.

## SUPA-02 — Operaciones sin permisos de escritura móviles
La migración `20261010010000_operational_commands.sql` agrega RPC `api_*` **solo para `service_role`**, para crear pacientes, registrar profesionales asociados a Auth propio, agendar sin superposiciones, iniciar visitas, agregar notas versionadas, enviar a revisión y cancelar. Las claves UUID de reintento evitan duplicaciones. Estos RPC NO son directamente accesibles por clientes autenticados o anónimos. Aún no existe Edge Function verificada, así que siguen **inutilizables desde la app**. Ver [SUPA-02](../docs/specs/SUPA-02-operational-commands.md).

## HC-01 — Episodios domiciliarios y plan/equipo como límites de acceso

La migración `20261010020000_homecare_episodes.sql` añade episodios propios del programa, profesionales del equipo y metadatos de versiones de planes, con FKs por paciente/organización/episodio y políticas RLS restrictivas. **No hay aprobaciones médicas ni indicaciones clínicas creadas por el sistema.**

- Todas las nuevas visitas requieren episodio y versión de plan. Las antiguas visitas del prototipo se mantienen sin episodio y fuera de las lecturas; no hay migración automática de pacientes o expedientes de la clínica.
- Solo miembros activos del equipo ven metadatos de su episodio. Las notas clínicas existentes continúan limitadas al profesional de la prestación asignada; el área administrativa no puede leerlas.
- La agenda anterior de SUPA-02 no acepta episodio y se **rechaza por diseño**; HC-02 implementará nuevos comandos de planificación con plan y equipo vigentes. No instalar aplicaciones esperando que la agenda antigua siga funcionando.
- El plan aprobado es **solo un estado de fixture SQL en GitHub**: cualquier aprobación válida requiere futura verificación de la habilitación profesional, indicación concreta y circuito médico.
- Ver [SPEC HC-01](../docs/specs/HC-01-episode-schema-and-rls.md).

## HC-02A — Coberturas prolongadas y relevos (no conectado)

La migración `20261010030000_homecare_coverage.sql` crea un roster único con `VISIT` y `SHIFT`, previene superposiciones entre ambos tipos para un profesional y documenta un relevo sin atribuir recepción automática. Cada nueva visita exige su cobertura `VISIT` canónica; las antiguas filas de demostración sin roster quedan ocultas.

Las notas clínicas continúan reservadas al profesional asignado. **HC-02B** agrega comandos restringidos para la planificación y la recepción de relevos; sin conceder escrituras directas a `service_role`. No implica aprobación clínica, firma válida ni agenda productiva. Ver [SPEC HC-02A](../docs/specs/HC-02A-coverage-handover.md).

## HC-02B — Operaciones transaccionales limitadas (sin aprobación médica)

La migración `20261010040000_homecare_controlled_commands.sql` crea operaciones con `SECURITY DEFINER` y `EXECUTE` exclusivo del rol `service_role`; no concede escrituras directas en las nuevas tablas. La Edge SUPA-03 verifica el usuario de este Supabase e inyecta `p_actor`; las funciones SQL comprueban de nuevo membresía, organización, profesional, episodio y plan. Solo el backend mantiene la clave privilegiada.

- Crea episodio **DRAFT** de paciente del programa, incorpora miembros de equipo (sin elevar a jefe médico) y metadatos de plan **DRAFT**, con claves de reintento y auditoría.
- Programa `VISIT` o `SHIFT` **solamente** si el episodio ya está ACTIVE y existe plan APPROVED por un mecanismo clínico externo todavía pendiente. La visita puntual y su cobertura se crean en una única transacción.
- Pide relevos entre guardias consecutivas y permite al profesional receptor registrar únicamente recepción. No representa firma, consentimiento ni intercambio médico.
- Corrige el control de vigencia: se verifica **inicio y fin** de la cobertura con respecto al plan.
- **No existe ninguna acción para aprobar planes ni activar episodios**, de modo que los episodios nuevos no pueden transformarse automáticamente en prestaciones clínicas operativas.

La prueba SQL usa episodios y planes sintéticos previamente aprobados como fixtures del entorno de CI; estos estados no prueban acreditación profesional. Véase [HC-02B](../docs/specs/HC-02B-controlled-planning-commands.md).

## HC-02C1B y SUPA-04 — Revisión pendiente y cierre de rutas antiguas

La revisión de metadatos de un plan domiciliario ahora se solicita mediante `requestHomecarePlanReview`, respaldada por `api_hc_request_plan_review`. La tabla `homecare_plan_review_requests` solo permite estado **PENDING**, con RLS para administración y sin capacidad de aprobación ni activación clínica. La migración y sus pruebas se incluyen después de HC-02B en el Quality Gate.

**SUPA-04:** la Edge deja de exponer las rutas clínicas heredadas `scheduleVisit`, `beginVisit`, `addClinicalNote`, `submitVisitReview` y `cancelVisit`. Las definiciones RPC históricas de SUPA-02 permanecen en la base para las pruebas originales, pero SUPA-04B **revoca su permiso EXECUTE a service_role** tras dichas pruebas. Por tanto ya no son un contrato operativo para el móvil ni el servidor. Se debe evitar cualquier acceso público directo a operaciones que utilicen `service_role`. No habilitar toma de notas, inicio de atención o cierre hasta definir y aprobar los circuitos clínicos.

## STAGING-01A — Preflight sin credenciales y runbook (aún no conectado)

El comando `node scripts/staging-preflight.mjs --ci` comprueba sin conexión externa la consistencia mínima del repositorio: doce migraciones, id local de CLI, JWT obligatorio en Edge, revisión administrativa PENDING y bloqueo de RPC clínicas históricas. También se ejecuta automáticamente en GitHub Actions.

El modo opcional `--probe` es **posterior** a crear y asegurar un proyecto staging nuevo de internación domiciliaria. Exige aprobación explícita y una clave **publicable**, nunca secreta, y solo realiza pruebas negativas sin JWT ni mutaciones. No equivale a aprobación de seguridad, RLS, identidad o clínica.

Runbook: [STAGING-01](../docs/operations/STAGING-01-runbook.md) · SPEC: [STAGING-01A](../docs/specs/STAGING-01A-safe-preflight.md). No usar reset remoto/destructivo; no aplicar el shim sintético de auth en Supabase.

**STAGING-01B actualizado por SEC-READ-02B:** `node scripts/staging-rls-verify.mjs --ci` funciona sin red; los tests negativos con mocks forman parte de CI. `--check-env` y `--probe` requieren dos organizaciones, usuarios y episodios ficticios más un JWT vencido, sin credenciales en GitHub. El ensayo remoto utiliza **POST Edge de lectura sin escritura** con actor verificado en Auth/sesión activa: resultado propio no vacío, resultado ajeno vacío. Adicionalmente se exigen **14 GET directos a PostgREST con `limit=0` rechazados** (401/403), sin recuperar filas. Esto prueba el alcance Edge y los grants denegados, no todas las políticas RLS internas de la nube. Ejecutar solo en staging independiente aprobado. [SPEC STAGING-01B](../docs/specs/STAGING-01B-cross-tenant-rls.md).

## SEC-SESSION-01 — sesión Auth viva además de JWT firmado

La migración `20261010070000_live_auth_session_gate.sql` incorpora RPC exclusiva del backend `api_is_live_session(p_user,p_session)`, que comprueba la fila de `auth.sessions` del Supabase autónomo. La Edge verifica primero el JWT con Auth, compara `sub` con el usuario verificado y extrae `session_id`; **solo entonces** consulta la RPC. Sin sesión activa no despacha acciones. La migración no crea ni elimina sesiones reales, y el stub `auth.sessions` utilizado por PostgreSQL CI **nunca se aplica al Supabase real**.

Esta protección responde al hecho de que `signOut` puede dejar access JWT válidos hasta expiración. **Aún requiere validación contra el esquema Auth administrado en un staging real**, además de las políticas de autorización médica que siguen bloqueadas. [SPEC SEC-SESSION-01](../docs/specs/SEC-SESSION-01-live-session-gate.md).

## HC-READ-01 — Lectura mínima de coberturas con sesión verificada (sin desplegar)

La migración `20261010080000_homecare_roster_edge_read.sql` revoca SELECT directo a `authenticated` y `anon` en `homecare_coverage_assignments` y `homecare_shift_handovers`, cerrando la vía de JWT firmado pero sesión cerrada que el gate Edge no puede controlar si se usa PostgREST directamente. La RPC `api_hc_list_my_coverages(p_actor)` es exclusiva de `service_role`; consulta **solo** seis campos de hasta 100 coberturas del profesional autorizado, con pertenencia activa a equipo, organización y episodio. La Edge añade el actor obtenido de Auth y exige sesión viva antes de invocarla. No se aceptan filtros de paciente/organización indicados por la app. Sin proyecto staging real la consulta no está habilitada para uso clínico.

**SEC-READ-02A (décima migración):** revoca SELECT directo de otras once tablas: organizaciones, membresías, profesionales, pacientes, visitas, notas, constancias, auditoría, equipos, versiones de plan y solicitudes de revisión. Junto con HC-READ-01 son trece tablas, más una excepción histórica de episodios. [SPEC SEC-READ-02A](../docs/specs/SEC-READ-02A-sensitive-table-lockdown.md).

**SEC-READ-02B (undécima migración):** revoca también SELECT directo sobre `homecare_episodes`, completando **catorce tablas sin lectura directa por JWT**. Añade `api_hc_episode_scope(p_actor,p_episode)` exclusiva del backend con resultado mínimo `[id,organization_id]` para episodios permitidos. La Edge valida Auth y sesión activa antes de consultar, y la prueba STAGING-01B sustituye su GET directo por cuatro solicitudes Edge más 14 comprobaciones negativas de PostgREST sin filas. No se ha verificado en Supabase alojado ni permite atención de pacientes. [SPEC SEC-READ-02B](../docs/specs/SEC-READ-02B-episode-edge-gate.md). [SPEC HC-READ-01](../docs/specs/HC-READ-01-session-scoped-roster.md).

## SEC-SURFACE-01 — Control de regresiones de permisos ante nuevas migraciones

Tras las doce migraciones, el Quality Gate recorre **dinámicamente** los objetos del catálogo de PostgreSQL: deniega a `authenticated` y `anon` permisos de SELECT/escritura sobre cualquier tabla o vista pública nueva, permisos de secuencias y EXECUTE sobre RPC `api_*` y funciones `SECURITY DEFINER` públicas. Así no depende únicamente del inventario fijo de catorce tablas conocido hoy. Valida también el `search_path` fijado en funciones privilegiadas. La auditoría es sintética; el ensayo contra Supabase alojado sigue pendiente. [SPEC SEC-SURFACE-01](../docs/specs/SEC-SURFACE-01-dynamic-privilege-guard.md).

## STAGING-01E — Historial registrado por Supabase (no desplegado)

El SQL `staging/01e_migration_history_readonly.sql` consulta únicamente el historial `supabase_migrations.schema_migrations.version` en una **transacción de solo lectura**: requiere 11 versiones exactas. CI usa un stub descartable con 11 versiones, y verifica rechazo de historial extra, faltante o sustituido. Un operador autorizado debe revisar `supabase migration list --linked` y `supabase db push --dry-run` antes de cualquier instalación remota; **este repositorio no ejecuta despliegues automáticamente**. El historial registra versiones, no demuestra por sí solo igualdad de bytes ni prueba Auth administrado. [SPEC STAGING-01E](../docs/specs/STAGING-01E-migration-history-readiness.md).

## STAGING-01F — Suite única de identidad, tenant y revocación (pendiente de nube)

El comando `scripts/staging-integrated-verify.mjs` compone las pruebas HTTP de 01A/01B/01C (30 solicitudes acotadas) contra una sola referencia de Supabase. Obliga a compartir el JWT activo y el JWT vencido de la cuenta A entre los dos ensayos autenticados y rechaza diferencias de identidad. CI y `--check-env` son offline; `--probe` está reservado a un proyecto independiente real aprobado, con datos sintéticos. La declaración de titularidad no reemplaza una inspección del Dashboard. No acredita catálogos SQL, migraciones, backups ni seguridad clínica. [SPEC STAGING-01F](../docs/specs/STAGING-01F-integrated-identity-run.md).

## Puesta en marcha posterior (NO realizada)
1. La administración propietaria de Pediatrics crea un **proyecto Supabase nuevo y separado**, comprueba responsabilidad contractual, región de residencia de datos, privacidad, backup/restore y política de retención. Nunca usar el proyecto SICOM ni un entorno de CONSULTLAN.
2. Configura Supabase Auth con registro abierto/usuarios anónimos deshabilitados; define invitaciones, MFA, rotación, recuperación y control de sesiones. **No** desplegar con pacientes reales sin una revisión de cumplimiento sanitario/contractual.
3. Aplica migraciones versionadas sobre un entorno **staging vacío** mediante un mecanismo autenticado del equipo; revisa grants, RLS, esquema `private` no expuesto, funciones SECURITY DEFINER y acceso a tablas.
4. Ejecuta `supabase test db` y pruebas de acceso desde clientes externos contra staging con cuentas ficticias (aun pendientes) antes de producción; una prueba en Postgres puro **no sustituye** la evaluación integral de Supabase.
5. Solo una vez auditada la seguridad, crear funciones Edge para alta de usuarios/pacientes, agenda y registros, usando privilegios server-side y mecanismos de auditoría.
6. Diseñar Storage **privado** con políticas de objetos y retención antes de incorporar PDFs, firmas o cualquier adjunto. No crear buckets públicos de documentos clínicos.
7. Solo con autorizaciones válidas y aprobaciones legales, integrar las firmas electrónicas y la firma digital del profesional por proveedor/certificador autorizado.

## Variables de la app (futuro)
La app podrá recibir URL del **Supabase propio** y su clave **publicable**, más el JWT de la sesión autenticada. La clave `service_role` y secretos de firma **nunca** pueden estar en el bundle móvil, secretos públicos del build ni repositorios.
No se configura ninguna URL real en este gate. La demo sigue ejecutándose 100% con datos sintéticos en memoria.

## HC-READ-02 — Lectura paginada acotada (solo GitHub, no desplegada)

La migración número 12, `20261011100000_homecare_roster_keyset_read.sql`, agrega una RPC **solo para service_role** con ventana de UTC máxima de 32 días, 100 coberturas por página y cursor compuesto `scheduled_start + id`. Incluye coberturas largas que comenzaron antes pero siguen abiertas dentro de la ventana. La Edge reconoce rutas de primera/siguiente página tras Auth y verificación de sesión activa; nunca acepta identidad u organización elegidas por la app.

Las primeras once migraciones **no se modifican**. GitHub CI aplica esta última después de los tests anteriores y verifica con 105 coberturas sintéticas que no hay saltos, duplicados ni accesos cruzados. `hasMore=false` significa solamente que esa consulta no halló más filas al ejecutarse: **no es snapshot consistente entre requests**, ni evidencia de cobertura clínica completa. El cliente móvil paginado se prepara en HC-READ-02B, mediante código inerte y pruebas sintéticas; permanece desconectado de App y de cualquier paciente real. [SPEC HC-READ-02](../docs/specs/HC-READ-02-keyset-roster.md).

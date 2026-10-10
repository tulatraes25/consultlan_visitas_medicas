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

**Todas las tablas tienen RLS habilitado. Solo se concede SELECT restringido a `authenticated`; NO se concede INSERT/UPDATE/DELETE desde dispositivos.** Para altas de usuarios, agenda, asignaciones y evolución clínica se implementarán funciones futuras con autorización y auditoría transaccional. La autorización externa de usuario debe construirse en el servidor, no a partir del payload móvil.

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

El comando `node scripts/staging-preflight.mjs --ci` comprueba sin conexión externa la consistencia mínima del repositorio: siete migraciones, id local de CLI, JWT obligatorio en Edge, revisión administrativa PENDING y bloqueo de RPC clínicas históricas. También se ejecuta automáticamente en GitHub Actions.

El modo opcional `--probe` es **posterior** a crear y asegurar un proyecto staging nuevo de internación domiciliaria. Exige aprobación explícita y una clave **publicable**, nunca secreta, y solo realiza pruebas negativas sin JWT ni mutaciones. No equivale a aprobación de seguridad, RLS, identidad o clínica.

Runbook: [STAGING-01](../docs/operations/STAGING-01-runbook.md) · SPEC: [STAGING-01A](../docs/specs/STAGING-01A-safe-preflight.md). No usar reset remoto/destructivo; no aplicar el shim sintético de auth en Supabase.

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

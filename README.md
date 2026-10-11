# Internación domiciliaria pediátrica — plataforma independiente

Aplicación móvil para la **continuidad de cuidados domiciliarios pediátricos** de niños con distintos niveles de complejidad y un equipo interdisciplinario. **No es una clínica ambulatoria ni comparte pacientes con los consultorios de Pediatrics.** Los turnos y visitas pertenecen a un episodio longitudinal de internación domiciliaria; también existen coberturas prolongadas y relevos. Teléfonos y tablets Android/iOS, con identidad visual inspirada en CONSULTLAN.

**Decisión arquitectónica vigente:** el sistema se crea de cero con un proyecto **Supabase completamente autónomo**. **No se conecta al servidor de Pediatrics ni comparte usuarios, pacientes, turnos, tokens o bases de datos con CONSULTLAN.** Solo se reutiliza su lenguaje visual verde.

## Estado
- Frontend React Native/Expo: navegación, **agenda de VISIT/SHIFT con franjas variables y guardias nocturnas**, y firmas táctiles **solo de demostración**, con datos sintéticos y sin transmisión de trazos. La agenda móvil es orientativa: backend clínico real aún bloqueado.
- Backend: migraciones SUPA-01/02, HC-01 (episodios/planes/equipo), HC-02A (roster visitas/guardias/relevos), **HC-02B** (comandos administrativos con auditoría) y **HC-READ-01** (lectura mínima de agenda propia solo vía Edge, con sesión activa y RPC). **Solo se crean episodios y metadatos de plan en DRAFT; la aprobación médica, activación de casos y firmas siguen bloqueadas**. Agenda futura requiere plan aprobado de un circuito clínico todavía no implementado. **Sin proyecto Supabase desplegado ni pacientes reales, sin órdenes médicas ni servicios asistenciales activos.**
- Documentación clínica: **HC-03A** inventaría siete plantillas verificadas y **HC-03B** las presenta en teléfonos/tablets como estructuras no editables, con navegación por especialidad y desde la visita ficticia **sin transmitir datos del paciente**. Kardex, signos vitales, procedimientos y crisis permanecen en el domicilio. No se generan documentos ni firmas.
- Integración clínica y firmas: **no implementadas**. Supabase no aporta por sí solo firma digital certificada.

## Documentación y código
- [ADR-002 arquitectura autónoma](docs/adr/ADR-002-supabase-autonomo.md) — decisión de infraestructura.
- [ADR-003 internación domiciliaria](docs/adr/ADR-003-homecare-case-first.md) — población diferenciada y episodio asistencial longitudinal; diseño rector del producto.
- [SPEC-001](docs/specs/SPEC-001-visitas-domiciliarias.md) — requisitos y pendientes.
- [HC-01 episodio, equipo y RLS](docs/specs/HC-01-episode-schema-and-rls.md) — migración PostgreSQL y controles de seguridad; sin aprobación clínica real.
- [HC-02A coberturas y relevos](docs/specs/HC-02A-coverage-handover.md) — visitas puntuales y guardias extensas con prevención de superposición; todavía no hay altas operativas.
- [HC-02B operaciones controladas](docs/specs/HC-02B-controlled-planning-commands.md) — admisión en borrador, integrantes del equipo, planificación condicional y recepción de relevos, sin simular aprobaciones clínicas.
- [HC-03A contratos de formularios](docs/specs/HC-03A-source-form-contracts.md) — fieles a los campos verificados del material recibido, con prohibición expresa de captura clínica real y firma simulada.
- [HC-03B pantallas de previsualización](docs/specs/HC-03B-mobile-form-preview.md) — pestaña Planillas, seis especialidades, evolución separada, hojas físicas y tests de paridad documental.
- [MOB-ROSTER-02 coberturas flexibles](docs/specs/MOB-ROSTER-02-flexible-coverage.md) — reemplaza slots de 40 minutos por fechas, guardias y visitas variables, exclusión de superposiciones y continuidad no confirmada.
- [MOB-HC-EPISODE-01 episodios móviles](docs/specs/MOB-HC-EPISODE-01-readonly-timeline.md) — navegación caso-primero en teléfonos/tablets, coberturas ficticias agrupadas estrictamente por paciente y episodio, sin acciones clínicas.
- [MOB-HC-HANDOVER-01 continuidad horaria de guardias](docs/specs/MOB-HC-HANDOVER-01-safe-continuity-preview.md) — candidatos de relevo solo con paciente+episodio idénticos y cambio de profesional, visibles como sugerencias no acreditadas; no documenta actos clínicos.
- [MOB-HC-TEAM-01 profesionales por episodio](docs/specs/MOB-HC-TEAM-01-synthetic-episode-participants.md) — muestra qué profesionales ficticios aparecen en coberturas de un episodio, con conteos por visita/guardia, sin inferir equipo clínico autorizado.
- [MOB-HC-PLAN-01 versiones de borrador por episodio](docs/specs/MOB-HC-PLAN-01-draft-only-case-metadata.md) — proyecta únicamente número de versión y cantidad de borradores de plan ficticios por paciente+episodio, sin aprobación, firma ni indicaciones.
- [MOB-HC-REVIEW-02 cola coherente de revisiones](docs/specs/MOB-HC-REVIEW-02-draft-case-consistency.md) — vincula cada solicitud ficticia pendiente a la versión exacta de un plan DRAFT del mismo paciente/episodio, sin aprobación ni acciones clínicas.
- [MOB-DATA-01 lectura de coberturas](docs/specs/MOB-DATA-01-readonly-staging-coverage.md) — contrato móvil Edge dormido con JWT de usuario y sesión activa requerida; backend HC-READ-01 implementado y probado sintéticamente, sin conexión real ni consulta directa a tablas.
- [HC-READ-01 lectura de agenda propia](docs/specs/HC-READ-01-session-scoped-roster.md) — RPC de seis campos solo para profesionales activos y su episodio; cierra la lectura directa de coberturas/relevos con JWT. Aún pendiente staging independiente.
- [SEC-READ-02A cierre de lectura directa](docs/specs/SEC-READ-02A-sensitive-table-lockdown.md) — revocación de once tablas sensibles adicionales, antecedente con excepción transitoria ya resuelta por SEC-READ-02B.
- [SEC-READ-02B lectura de episodio por Edge](docs/specs/SEC-READ-02B-episode-edge-gate.md) — revoca el último SELECT móvil sobre episodios, valida identidad/sesión y habilita prueba sintética de alcance por organización, sin conexión real.
- [SEC-SURFACE-01 guardia automática de permisos](docs/specs/SEC-SURFACE-01-dynamic-privilege-guard.md) — inspección dinámica de todas las tablas, vistas, secuencias y RPC de `public` para bloquear nuevas exposiciones accidentales en futuras migraciones.
- [STAGING-01D atestación de fuente y catálogo](docs/specs/STAGING-01D-source-and-catalog-attestation.md) — manifiesto SHA-256 de once migraciones y runtime Edge desde commit Git limpio, más inspección SQL estructural de solo lectura; no acredita despliegue.
- [STAGING-01E historial de migraciones](docs/specs/STAGING-01E-migration-history-readiness.md) — consulta SQL READ ONLY que rechaza versiones extra, faltantes o sustituidas; ensayada en PostgreSQL sintético, aplicación real aún bloqueada.
- [FORM-001](docs/specs/FORM-001-inventario-clinico.md) — planillas de origen inventariadas sin datos de pacientes.
- [Supabase: migración y pruebas RLS](supabase/README.md) — instalación pendiente de proyecto en la nube, prueba en PostgreSQL sintético.
- [STAGING-01A preflight](docs/specs/STAGING-01A-safe-preflight.md) — inspección offline del esquema y controles de destino; las pruebas negativas remotas son **opcionales** y requieren staging independiente expresamente autorizado.
- [STAGING-01B dos organizaciones](docs/specs/STAGING-01B-cross-tenant-rls.md) — test positivo/negativo de RLS con cuentas y episodios ficticios, solo lectura; sin ejecución real hasta que se prepare Supabase staging.
- [SEC-SESSION-01 sesión activa](docs/specs/SEC-SESSION-01-live-session-gate.md) — la Edge verifica también que `session_id` siga presente en Auth; pendiente validación real en staging, sin pacientes.
- [SEC-SESSION-02 integración Edge](docs/specs/SEC-SESSION-02-integrated-edge-auth-test.md) — tests Deno completos de Auth → sesión activa → comando, con fallos bloqueantes y sin nube.
- [STAGING-01C sesiones revocadas](docs/specs/STAGING-01C-session-revocation-probe.md) — verificador offline-first que contrasta sesión activa vs. cerrada con JWT aún válido, usando únicamente acciones Edge desconocidas y un staging autónomo previamente autorizado; no ejecutado contra la nube.
- [STAGING-01 runbook](docs/operations/STAGING-01-runbook.md) — creación manual de Supabase, controles de seguridad/privacidad, staging sin datos reales, recuperación y no-go clínicos.
- [App móvil](apps/mobile/README.md) — demo Android/iOS y tests de UI.
- [Política de episodio domiciliario](src/domain/homecare-policy.mjs) — reglas de integridad para servicio, episodio, paciente y plan, probadas con datos sintéticos; todavía no conectadas al backend.
- [Contratos históricos de visita](src/domain/visit-policy.mjs) — reglas auxiliares de estado/firma; no middleware real.
- [OpenAPI histórico](contracts/openapi.visits.json) — borrador conceptual no desplegado, **no es un API de CONSULTLAN**.

## Cómo validar sin acceso a pacientes
- `npm test` en la raíz (reglas de dominio + contratos históricos).
- `cd apps/mobile && npm install && npm run typecheck && npm run test:ui` (interfaz móvil simulada).
- GitHub Actions ejecuta además PostgreSQL real para comprobar RLS y FK cruzadas con usuarios/pacientes inventados.

## Seguridad
Este repositorio es público: **nunca** subir datos reales, imágenes de firmas, PDFs clínicos, historiales, contraseñas, tokens, `service_role`, claves privadas ni backups. La app móvil **jamás** recibe credenciales privilegiadas. Solo un backend/Edge Function auditado podrá realizar operaciones de escritura, alta de usuarios o firma/cierre.

Antes de utilizarse clínicamente falta crear un Supabase propio, verificar propiedad/región/legalidad/retención, activar configuración de seguridad, automatizar funciones de escritura, probar restauraciones y validar firmas, usuarios y autorizaciones con Pediatrics.

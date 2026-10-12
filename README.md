# Internación domiciliaria pediátrica — plataforma independiente

Aplicación móvil para la **continuidad de cuidados domiciliarios pediátricos** de niños con distintos niveles de complejidad y un equipo interdisciplinario. **No es una clínica ambulatoria ni comparte pacientes con los consultorios de Pediatrics.** Los turnos y visitas pertenecen a un episodio longitudinal de internación domiciliaria; también existen coberturas prolongadas y relevos. Teléfonos y tablets Android/iOS, con identidad visual inspirada en CONSULTLAN.

**Decisión arquitectónica vigente:** el sistema se crea de cero con un proyecto **Supabase completamente autónomo**. **No se conecta al servidor de Pediatrics ni comparte usuarios, pacientes, turnos, tokens o bases de datos con CONSULTLAN.** Solo se reutiliza su lenguaje visual verde.

## Estado
- Frontend React Native/Expo: navegación, **agenda de VISIT/SHIFT con franjas variables y guardias nocturnas**, y firmas táctiles **solo de demostración**, con datos sintéticos y sin transmisión de trazos. La agenda móvil es orientativa: backend clínico real aún bloqueado.
- Backend: migraciones SUPA-01/02, HC-01 (episodios/planes/equipo), HC-02A (roster visitas/guardias/relevos), **HC-02B** (comandos administrativos con auditoría) y **HC-READ-02** (agenda propia paginada por Edge, ventana temporal, sesión activa y RPC). La ruta Edge antigua de HC-READ-01 está retirada; solo queda su SQL histórico no expuesto al móvil. **Solo se crean episodios y metadatos de plan en DRAFT; la aprobación médica, activación de casos y firmas siguen bloqueadas**. Agenda futura requiere plan aprobado de un circuito clínico todavía no implementado. **Sin proyecto Supabase desplegado ni pacientes reales, sin órdenes médicas ni servicios asistenciales activos.**
- Documentación clínica: **HC-03A** inventaría siete plantillas verificadas y **HC-03B** las presenta en teléfonos/tablets como estructuras no editables, con navegación por especialidad y desde la visita ficticia **sin transmitir datos del paciente**. Kardex, signos vitales, procedimientos y crisis permanecen en el domicilio. No se generan documentos ni firmas.
- Integración clínica y firmas: **no implementadas**. Supabase no aporta por sí solo firma digital certificada.

## Documentación y código
- [ADR-002 arquitectura autónoma](docs/adr/ADR-002-supabase-autonomo.md) — decisión de infraestructura.
- [ADR-003 internación domiciliaria](docs/adr/ADR-003-homecare-case-first.md) — población diferenciada y episodio asistencial longitudinal; diseño rector del producto.
- [OSS-HC-ARCH-01 benchmark de arquitecturas públicas](docs/research/OSS-HC-ARCH-01-github-benchmark.md) — comparación verificable de sistemas homecare/EHR/campo en GitHub, licencias y límites de reutilización.
- [ADR-004 plataforma basada en benchmark](docs/adr/ADR-004-benchmark-driven-homecare-platform.md) — preservar Supabase/Expo y preparar web de coordinación independiente, sin importar código ajeno.
- [WEB-COORD-01 consola web futura](docs/specs/WEB-COORD-01-coordination-console.md) — especificación de roles, permisos y pantallas administrativas.
- [WEB-COORD-01A laboratorio visual navegable](docs/specs/WEB-COORD-01A-three-visual-prototypes.md) — tres propuestas web A/B/C con el mismo roster inventado; [preview autónoma sin dependencias](apps/web-prototypes/preview.html). No es un panel web clínico desplegado.
- [WEB-COORD-01B-QA navegador real](docs/specs/WEB-COORD-01B-browser-qa.md) — pruebas A/B/C en Chrome, teclado, filtros, continuidad nocturna, 1440/1024/768 px y capturas PNG en GitHub Actions; revisión funcional de Coordinación pendiente.
- [WEB-COORD-01C compatibilidad y accesibilidad](docs/specs/WEB-COORD-01C-crossbrowser-wcag.md) — Firefox/WebKit y auditoría automatizada de WCAG para los tres prototipos, sin pacientes ni servidor.
- [SPEC-001](docs/specs/SPEC-001-visitas-domiciliarias.md) — requisitos y pendientes.
- [HC-01 episodio, equipo y RLS](docs/specs/HC-01-episode-schema-and-rls.md) — migración PostgreSQL y controles de seguridad; sin aprobación clínica real.
- [HC-02A coberturas y relevos](docs/specs/HC-02A-coverage-handover.md) — visitas puntuales y guardias extensas con prevención de superposición; todavía no hay altas operativas.
- [HC-02B operaciones controladas](docs/specs/HC-02B-controlled-planning-commands.md) — admisión en borrador, integrantes del equipo, planificación condicional y recepción de relevos, sin simular aprobaciones clínicas.
- [HC-03A contratos de formularios](docs/specs/HC-03A-source-form-contracts.md) — fieles a los campos verificados del material recibido, con prohibición expresa de captura clínica real y firma simulada.
- [HC-03B pantallas de previsualización](docs/specs/HC-03B-mobile-form-preview.md) — pestaña Planillas, seis especialidades, evolución separada, hojas físicas y tests de paridad documental.
- [HC-UX-02 planillas originales como eje de UX](docs/specs/HC-UX-02-source-bound-preview.md) — demostración HTML autónoma generada desde el catálogo de HC-03A (7 fuentes, 4 hojas físicas, expediente de 56 páginas solo referencial), paridad Node + navegador Chrome en celular/tablet/desktop, cero emisión.
- [HC-UX-04A planilla directa desde la prestación](docs/specs/HC-UX-04A-one-tap-assigned-form.md) — Inicio → planilla de especialidad en un toque, foco sin catálogo y bloqueos para especialidades desconocidas; solo datos ficticios y sin firma ni emisión.
- [HC-UX-04B1 selector de planilla de servidor](docs/specs/HC-UX-04B1-authorized-form-preview.md) — RPC/Edge de solo lectura, derivación por cobertura propia y especialidad activa con 13 migraciones verificadas; **no conecta la app a pacientes reales**.
- [HC-UX-04B2 lector móvil de planilla segura](docs/specs/HC-UX-04B2-assigned-form-reader.md) — cliente Edge y controlador de sesión con vista enfocada de una sola constancia; **sin montar en App ni conectar Supabase real**.
- [HC-UX-04C/04D flujo único y endurecido](docs/specs/HC-UX-04D-single-staging-workflow.md) — integra agenda propia y planilla con **un solo proveedor Auth/configuración Supabase**, descarta selecciones obsoletas y muestra una sola pantalla. Sigue dormido: no se importa en App ni consulta pacientes reales.
- [HC-UX-03A revisión segura de originales](docs/specs/HC-UX-03A-private-source-review.md) — matriz bloqueante de revisión documental, sin importar archivos privados; cotejo de IDs de campos sin PHI, sin permitir emitir PDFs o firmas.
- [MOB-ROSTER-02 coberturas flexibles](docs/specs/MOB-ROSTER-02-flexible-coverage.md) — reemplaza slots de 40 minutos por fechas, guardias y visitas variables, exclusión de superposiciones y continuidad no confirmada.
- [MOB-HC-EPISODE-01 episodios móviles](docs/specs/MOB-HC-EPISODE-01-readonly-timeline.md) — navegación caso-primero en teléfonos/tablets, coberturas ficticias agrupadas estrictamente por paciente y episodio, sin acciones clínicas.
- [MOB-HC-HANDOVER-01 continuidad horaria de guardias](docs/specs/MOB-HC-HANDOVER-01-safe-continuity-preview.md) — candidatos de relevo solo con paciente+episodio idénticos y cambio de profesional, visibles como sugerencias no acreditadas; no documenta actos clínicos.
- [MOB-HC-TEAM-01 profesionales por episodio](docs/specs/MOB-HC-TEAM-01-synthetic-episode-participants.md) — muestra qué profesionales ficticios aparecen en coberturas de un episodio, con conteos por visita/guardia, sin inferir equipo clínico autorizado.
- [MOB-HC-PLAN-01 versiones de borrador por episodio](docs/specs/MOB-HC-PLAN-01-draft-only-case-metadata.md) — proyecta únicamente número de versión y cantidad de borradores de plan ficticios por paciente+episodio, sin aprobación, firma ni indicaciones.
- [MOB-HC-REVIEW-02 cola coherente de revisiones](docs/specs/MOB-HC-REVIEW-02-draft-case-consistency.md) — vincula cada solicitud ficticia pendiente a la versión exacta de un plan DRAFT del mismo paciente/episodio, sin aprobación ni acciones clínicas.
- [MOB-HC-PRO-01 agenda ficticia por profesional](docs/specs/MOB-HC-PRO-01-own-roster-preview.md) — añade una vista de coberturas propias filtrada por profesional DEMO, sin revelar datos libres, sin autenticación y sin otorgar permisos reales.
- [MOB-DATA-01 lectura de coberturas](docs/specs/MOB-DATA-01-readonly-staging-coverage.md) — contrato móvil Edge dormido con JWT de usuario y sesión activa requerida; backend HC-READ-01 implementado y probado sintéticamente, sin conexión real ni consulta directa a tablas.
- [MOB-DATA-02 seguridad del ciclo de sesión](docs/specs/MOB-DATA-02-session-bound-roster.md) — controlador de lectura de staging con descarte de respuestas tardías, limpieza al cerrar sesión o salir de la pantalla y revalidación de JWT; pantalla de prueba aún desconectada.
- [MOB-DATA-04 orden cronológico íntegro](docs/specs/MOB-DATA-04-chronological-roster.md) — valida el orden Edge por instante microsegundo + UUID; falla cerrado ante inversión, sin ocultar el límite de cien registros.
- [MOB-DATA-03 integridad de coberturas](docs/specs/MOB-DATA-03-coverage-integrity.md) — valida calendario ISO real y rechaza IDs duplicados en la lectura mínima de agenda Edge; no utiliza pacientes ni servidor real.
- [MOB-TIME-01 presentación horaria segura](docs/specs/MOB-TIME-01-explicit-service-timezone.md) — hora local del servicio con zona IANA configurada y diferencia UTC visible por cobertura, incluidas guardias nocturnas y cambios DST; staging inerte.
- [MOB-AUTH-02 barrera de visibilidad autenticada](docs/specs/MOB-AUTH-02-fail-closed-roster-visibility.md) — no renderizar coberturas antes del enlace Auth ni reusarlas al cambiar de proveedor, controlador o zona horaria; solo staging.
- [MOB-AUTH-01 limpieza automática por eventos Auth](docs/specs/MOB-AUTH-01-event-bound-roster.md) — exige un proveedor de Auth del Supabase independiente para borrar inmediatamente coberturas al iniciar/cerrar sesión, renovar token o cambiar de usuario; aún no conectado a App.
- [HC-READ-02B lector paginado móvil de staging](docs/specs/HC-READ-02B-mobile-windowed-coverage.md) — lectura Edge con dos páginas sintéticas 100+5, validación de cursor/ventana y limpieza por sesión; pantalla no enlazada a App.
- [HC-READ-02 paginación acotada de coberturas](docs/specs/HC-READ-02-keyset-roster.md) — RPC nueva, cursor por instante+UUID y ventana UTC, 105 filas sintéticas; todavía sin Supabase remoto ni pantalla móvil conectada.
- [HC-READ-01 lectura de agenda propia](docs/specs/HC-READ-01-session-scoped-roster.md) — RPC de seis campos solo para profesionales activos y su episodio; cierra la lectura directa de coberturas/relevos con JWT. Aún pendiente staging independiente.
- [SEC-READ-02A cierre de lectura directa](docs/specs/SEC-READ-02A-sensitive-table-lockdown.md) — revocación de once tablas sensibles adicionales, antecedente con excepción transitoria ya resuelta por SEC-READ-02B.
- [SEC-READ-03 salida segura de episodio](docs/specs/SEC-READ-03-edge-episode-output-gate.md) — Edge rechaza cualquier atributo clínico adicional, respuesta no unívoca o episodio diferente antes de serializar el alcance al móvil; pruebas Deno con datos sintéticos.
- [SEC-READ-02B lectura de episodio por Edge](docs/specs/SEC-READ-02B-episode-edge-gate.md) — revoca el último SELECT móvil sobre episodios, valida identidad/sesión y habilita prueba sintética de alcance por organización, sin conexión real.
- [SEC-SURFACE-01 guardia automática de permisos](docs/specs/SEC-SURFACE-01-dynamic-privilege-guard.md) — inspección dinámica de todas las tablas, vistas, secuencias y RPC de `public` para bloquear nuevas exposiciones accidentales en futuras migraciones.
- [STAGING-01D atestación de fuente y catálogo](docs/specs/STAGING-01D-source-and-catalog-attestation.md) — manifiesto SHA-256 de trece migraciones y runtime Edge desde commit Git limpio, más inspección SQL estructural de solo lectura; no acredita despliegue.
- [STAGING-01E historial de migraciones](docs/specs/STAGING-01E-migration-history-readiness.md) — consulta SQL READ ONLY que rechaza versiones extra, faltantes o sustituidas; ensayada en PostgreSQL sintético, aplicación real aún bloqueada.
- [STAGING-01F verificaciones integradas](docs/specs/STAGING-01F-integrated-identity-run.md) — unifica los controles Auth, aislamiento y sesión revocada con identidades sintéticas compartidas; CI offline y ejecución remota pendiente.
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

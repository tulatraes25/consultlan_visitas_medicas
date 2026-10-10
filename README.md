# Internación domiciliaria pediátrica — plataforma independiente

Aplicación móvil para la **continuidad de cuidados domiciliarios pediátricos** de niños con distintos niveles de complejidad y un equipo interdisciplinario. **No es una clínica ambulatoria ni comparte pacientes con los consultorios de Pediatrics.** Los turnos y visitas pertenecen a un episodio longitudinal de internación domiciliaria; también existen coberturas prolongadas y relevos. Teléfonos y tablets Android/iOS, con identidad visual inspirada en CONSULTLAN.

**Decisión arquitectónica vigente:** el sistema se crea de cero con un proyecto **Supabase completamente autónomo**. **No se conecta al servidor de Pediatrics ni comparte usuarios, pacientes, turnos, tokens o bases de datos con CONSULTLAN.** Solo se reutiliza su lenguaje visual verde.

## Estado
- Frontend React Native/Expo: navegación, agenda y firmas táctiles **solo de demostración**, con datos sintéticos y sin transmisión de trazos.
- Backend: migraciones SUPA-01/02, **HC-01** (episodios/planes/equipo) y **HC-02A** (roster único de visitas y guardias, relevos). Edge SUPA-03 y permisos RLS con pruebas en GitHub. El agendamiento antiguo de visitas queda deliberadamente bloqueado; HC-02B deberá crear operaciones clínicas/administrativas supervisadas. **Sin proyecto Supabase desplegado ni pacientes reales, sin órdenes médicas ni servicios asistenciales activos.**
- Integración clínica y firmas: **no implementadas**. Supabase no aporta por sí solo firma digital certificada.

## Documentación y código
- [ADR-002 arquitectura autónoma](docs/adr/ADR-002-supabase-autonomo.md) — decisión de infraestructura.
- [ADR-003 internación domiciliaria](docs/adr/ADR-003-homecare-case-first.md) — población diferenciada y episodio asistencial longitudinal; diseño rector del producto.
- [SPEC-001](docs/specs/SPEC-001-visitas-domiciliarias.md) — requisitos y pendientes.
- [HC-01 episodio, equipo y RLS](docs/specs/HC-01-episode-schema-and-rls.md) — migración PostgreSQL y controles de seguridad; sin aprobación clínica real.
- [HC-02A coberturas y relevos](docs/specs/HC-02A-coverage-handover.md) — visitas puntuales y guardias extensas con prevención de superposición; todavía no hay altas operativas.
- [FORM-001](docs/specs/FORM-001-inventario-clinico.md) — planillas de origen inventariadas sin datos de pacientes.
- [Supabase: migración y pruebas RLS](supabase/README.md) — instalación pendiente de proyecto en la nube, prueba en PostgreSQL sintético.
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

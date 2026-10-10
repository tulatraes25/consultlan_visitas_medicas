# Internación domiciliaria pediátrica — plataforma independiente

Aplicación móvil para la **continuidad de cuidados domiciliarios pediátricos** de niños con distintos niveles de complejidad y un equipo interdisciplinario. **No es una clínica ambulatoria ni comparte pacientes con los consultorios de Pediatrics.** Los turnos y visitas pertenecen a un episodio longitudinal de internación domiciliaria; también existen coberturas prolongadas y relevos. Teléfonos y tablets Android/iOS, con identidad visual inspirada en CONSULTLAN.

**Decisión arquitectónica vigente:** el sistema se crea de cero con un proyecto **Supabase completamente autónomo**. **No se conecta al servidor de Pediatrics ni comparte usuarios, pacientes, turnos, tokens o bases de datos con CONSULTLAN.** Solo se reutiliza su lenguaje visual verde.

## Estado
- Frontend React Native/Expo: navegación, agenda y firmas táctiles **solo de demostración**, con datos sintéticos y sin transmisión de trazos.
- Backend: migraciones SUPA-01/02 y Edge SUPA-03 con RLS y operaciones transaccionales probadas mediante CI, **sin proyecto Supabase desplegado ni pacientes reales**. La estructura actual de `visits` debe adecuarse a los episodios longitudinales antes de uso asistencial (HC-01).
- Integración clínica y firmas: **no implementadas**. Supabase no aporta por sí solo firma digital certificada.

## Documentación y código
- [ADR-002 arquitectura autónoma](docs/adr/ADR-002-supabase-autonomo.md) — decisión de infraestructura.
- [ADR-003 internación domiciliaria](docs/adr/ADR-003-homecare-case-first.md) — población diferenciada y episodio asistencial longitudinal; diseño rector del producto.
- [SPEC-001](docs/specs/SPEC-001-visitas-domiciliarias.md) — requisitos y pendientes.
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

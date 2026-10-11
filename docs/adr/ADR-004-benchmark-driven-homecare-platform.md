# ADR-004 — Plataforma domiciliaria basada en benchmarks OSS

**Fecha:** 2026-10-11. **Estado:** ADOPTAR COMO GUÍA DE ARQUITECTURA, sin desplegar. **Precedencia:** ADR-002 (Supabase autónomo) y ADR-003 (episodio domiciliario caso-primero) permanecen vigentes.

## Contexto

La solicitud original exigía inspeccionar arquitecturas similares de GitHub, no solo referencias propias SICOM/CONSULTLAN. El inventario resultante está en [OSS-HC-ARCH-01](../research/OSS-HC-ARCH-01-github-benchmark.md). Se encontró software muy cercano al flujo de internación domiciliaria, pero con licencias fuertes (AGPL), limitaciones de madurez o stacks distintos. El panel web todavía no está implementado.

## Alternativas evaluadas

- **A: clonar Folk Care**: incluye agenda, personal, cuidados y backoffice, pero enfoque estadounidense, AGPL-3.0 y dominio no adaptado a internación pediátrica; requeriría rehacer migraciones y probar de cero el aislamiento. **RECHAZADA como código base; aceptada como patrón de módulos.**
- **B: instalar Medplum u OpenMRS como EHR principal**: clínicamente ricos, pero cambia infraestructura, licencias, costes y complejidad de operación, sin resolver por sí solo relevos y personal de campo locales. **RECHAZADA para V1; mantener mapeos FHIR de interoperabilidad y referencia para documentos.**
- **C: conservar Supabase independiente + Expo e incorporar modularidad por capacidades, consola web y criterios de campo**: minimiza reescritura, preserva controles certificados y permite auditoría incremental. **SELECCIONADA.**
- **D: clonar CommandCare**: buena UI semanal, pero hook real usa datos mock en memoria y la licencia no está confirmada por LICENSE. **RECHAZADA como backend o código; solo referencia visual.**
- **E: reemplazar Expo por FHIR Core Kotlin**: Android offline sólido, pero compromete soporte iOS/tablet y reescribe front; **RECHAZADA por ahora**.

## Arquitectura seleccionada: modular monolith, no microservicios inventados

Repositorios/capas lógicas futuras:

    apps/mobile/            Expo RN: profesionales, visitas, guardias y formularios autorizados
    apps/web/               PENDIENTE: coordinación, dirección médica, administración y auditoría
    packages/domain/        PENDIENTE: tipos e invariantes compartidos sin PHI
    packages/contracts/     PENDIENTE: contratos tipados Edge y validaciones compartidas
    packages/design-tokens/ PENDIENTE: tokens verdes CONSULTLAN auditados para web/móvil
    supabase/migrations/    EXISTE: Postgres, RLS y funciones de acceso
    supabase/functions/     EXISTE: Auth/sesión/Edge, comandos y lectura
    docs/                   ADR, SPEC, auditorías de licencias y runbooks
    tests/                  PENDIENTE: ampliación de e2e visual/móvil y seguridad

Los directorios marcados PENDIENTE **son propuesta, no código creado**. No migrar los módulos que ya pasaron CI sin una razón certificable. Compartir solo contratos, tokens y validaciones puras; no compartir secretos ni caches clínicos entre clientes.

## Límites de autoridad

- La identidad se autentica con **Auth del Supabase nuevo**. Las autorizaciones vienen de la vinculación efectiva profesional-equipo-episodio, membresía vigente, rol y RLS; nunca de una ruta, un filtro visual o el ID enviado por el cliente.
- **Coordinación** administra agenda, coberturas, disponibilidad y contingencias; no obtiene automáticamente permisos de lectura de evolución clínica.
- **Dirección Médica** valida planes, órdenes y actos clínicos por proceso propio (aún no implementado).
- **Profesional asignado** ve solo sus episodios y prestaciones autorizadas. **Responsable familiar** es un alcance distinto y no dispone del mismo acceso que un profesional.
- La app del profesional registra evidencias operativas bajo las reglas aprobadas; solo el servidor puede fechar, auditar y confirmar estados. Un trazo táctil no equivale a firma digital legal.
- Ninguna notificación automática reemplaza guardia telefónica, traslado, indicación o canal institucional de urgencia.

## Invariantes y límites operativos

1. **Episode-first:** todas las visitas, guardias y registros sanitarios pertenecen a un episodio del mismo paciente del programa domiciliario; no son pacientes del CONSULTLAN ambulatorio.
2. **Cobertura no es acto clínico:** distinguir asignada/confirmada/iniciada/finalizada/relevada de evolución/atención validada; registrar cambios y causal de excepciones. Nombres de estados finales requieren aprobación institucional.
3. **Continuidad sin ficción:** una guardia nocturna, relevo o ausencia debe estar explícitamente reportada; faltante o hueco de cobertura no debe desaparecer bajo un resumen de calendario.
4. **Planes versionados:** plan/orden DRAFT, aprobación clínica pendiente; no permitir formularios médicos definitivos sin fundamento, rol y versión inmutable.
5. **Interoperabilidad incremental:** mapeo orientativo FHIR solo para objetos clínicos que existan y estén aprobados. Sin declarar FHIR completo.
6. **Seguridad por defecto:** Edge verifica Auth y sesión viva en cada operación, RLS en Postgres, auditoría y cambios append-only cuando corresponda, tokens mínimos; no PostgREST directo sobre tablas sensibles.
7. **Móvil offline futuro:** requiere cifrado, minimización, expiración de contexto, sincronización idempotente, control de conflicto, borrado al revocar y pruebas con dispositivos reales. No habilitar offline antes de diseñar esas garantías.
8. **Licencias externas:** no importar código de Folk Care/CHT/Avni (AGPL), CommandCare (licencia no comprobada) u Ottehr (licencia restrictiva IA). Cualquier reutilización puntual Apache-2.0/MIT debe documentarse con licencia, procedencia, atributos y revisión.

## Orden de implementación por gates

1. **WEB-COORD-01A: especificación + 3 propuestas de UI web con datos sintéticos**, sin conexión al backend, revisión funcional. No alterar schemas.
2. **WEB-COORD-01B: diseño system/tokens y navegación de Coordinación**, con pruebas de componentes y accesibilidad en el cliente web, aún sin datos clínicos.
3. **WEB-COORD-02: integrar con Edge/RLS propio y permisos por perfil** solo tras un staging autónomo auditado y pruebas de límites multiorganización.
4. **HC-OFFLINE-01: diseño explícito de estrategia offline, seguridad de datos y conflictos** antes de implementar cachés clínicos.
5. **HC-CLINICAL-01: autoridad, versiones de plan, documentos y firma**, únicamente con Dirección Médica y revisión normativa.
6. Conciliación, reportes y portal familiar según prioridades institucionales y autorización del flujo real.

## Impacto de esta decisión

Se conserva el trabajo técnico previamente certificado, pero se corrige el sesgo de diseñar únicamente con los repositorios propios. La arquitectura del futuro panel web depende del mismo backend domiciliario, no de CONSULTLAN ni de SICOM. Cada gate implementado tendrá CI, revisión de amenazas y autorización de su ámbito; **ningún resultado de esta ADR acredita aptitud clínica**.

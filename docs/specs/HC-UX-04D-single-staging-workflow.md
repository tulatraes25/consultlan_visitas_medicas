# HC-UX-04D — Un único recorrido seguro de profesional

**SPEC/Kiro · 2026-10-12 · offline sintético, sin Supabase autorizado**

## Hallazgo
Existían dos compositores de `agenda propia -> planilla`. El primero (`StagingProfessionalFlowPreview`, HC-UX-04B5) recibía dos controladores construidos externamente, lo que permitía configuraciones/identidades de Supabase distintas sin una prueba de identidad común en el propio componente. El segundo (`StagingProfessionalWorkflowPreview`, HC-UX-04C) fabrica ambas lecturas desde **el mismo config**, pero mostraba la agenda mientras la planilla estaba abierta. Mantener dos rutas hace más difícil certificar UX, Auth y aislamiento de datos.

## Requisitos y decisión
1. Conservar exclusivamente `StagingProfessionalWorkflowPreview` como composición para el staging futuro. Retirar el componente y la suite antiguos; conservar en un documento la razón del retiro. Prohibir su reintroducción involuntaria en CI.
2. Crear agenda y formulario desde un único `ReadOnlyCoverageConfig` validado, con un único proveedor de eventos Auth. Nunca pasar controladores de proyectos diferentes.
3. La selección solo vale para la **identidad del snapshot** de la agenda donde se originó, no para un UUID arbitrario. Cambio de lista/página, sesión, ventana, timezone, proveedor Auth o configuración oculta la selección y borra modelo de planilla.
4. Visualizar **una sola pantalla** a la vez en móvil: agenda o planilla. Ocultar agenda y sus controles al lector de pantalla cuando hay una planilla enfocada. Botón volver accesible.
5. El segundo pedido a Edge debe revalidar al actor, episodio, cobertura y tipo de plantilla. Un rechazo HTTP 401/403 no genera fallback a una hoja genérica y no expone payload upstream.
6. No conectar `App.tsx`, Auth remoto ni datos reales. No implementar edición, firmas, historial clínico, descarga ni PDFs.

## Pruebas obligatorias
- Sin red/JWT durante render del staging inerte.
- `read roster -> select returned row -> explicit authorized form read`; una sola plantilla segura en la pantalla.
- `SIGNED_OUT`, refresh/cambio de Auth, ventana o controller: limpiar y no restaurar selección.
- Respuesta 403: sin plantilla visible, sin mensajes confidenciales.
- `projectRef` prohibido: rechazo antes de cualquier red.
- CI Node contratos y prohibición de compositor duplicado, Jest React Native, typecheck, exportación JS Android/iOS, Edge Deno y PostgreSQL RLS; PR y CI post-main.

## Bloqueo firme
**NO-GO:** UI dormida hasta STAGING-01F remoto en Supabase independiente autorizado con dos organizaciones ficticias y sin datos pacientes. La estructura mostrada no se equipara a documentos originales cotejados ni acredita actos médicos. Firmas y aprobación de plan clínico siguen fuera de alcance.

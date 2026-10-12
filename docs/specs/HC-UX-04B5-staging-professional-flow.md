# HC-UX-04B5 — De mi agenda a la planilla autorizada (composición staging)

**SPEC/Kiro · 2026-10-12 · solo fixtures sintéticos · dependencia HC-UX-04B2/04B3**

**HISTÓRICO / SUSTITUIDO POR HC-UX-04D.** El componente `StagingProfessionalFlowPreview` que aceptaba controladores de agenda y planilla por separado fue retirado por riesgo de mezclar dos configuraciones Supabase independientes. El único ensamblador permitido es `StagingProfessionalWorkflowPreview` de HC-UX-04C/04D: construye ambos controladores desde un mismo `ReadOnlyCoverageConfig` y vincula la selección al snapshot exacto de la agenda. Los criterios siguientes describen la validación histórica, no instrucciones vigentes de integración.

## Objetivo de experiencia
Un profesional sin conocimientos técnicos podrá consultar su lista de prestaciones y abrir la **estructura** de la única planilla correspondiente a la cobertura que acaba de seleccionar. La selección la hace a partir de una lista autorizada por el servidor; **jamás** escribiendo un UUID ni eligiendo otra especialidad.

## Alcance exacto
- `StagingPagedRosterPreview` añade un botón secundario por fila que **solo aparece si el integrador lo habilita**. No modifica su funcionamiento actual cuando se usa en solitario.
- `StagingProfessionalFlowPreview` compone la agenda paginada y el lector `StagingAssignedFormPreview` sin conectarlos a `App.tsx`. Necesita controladores ya construidos con el **mismo proyecto Supabase staging autónomo**, un mismo proveedor Auth y ventana UTC explícita.
- La lista y la planilla realizan **lecturas separadas**: primero `listMyHomecareCoveragesPage` y luego `resolveMyHomecareAttendanceTemplate`. El servidor debe volver a autenticar y autorizar la segunda petición. El móvil jamás transfiere actor, paciente, episodio o especialidad en el pedido de plantilla.
- La pulsación de la fila conserva la **identidad del snapshot completo** de la agenda, junto con Auth, instancia de ambos controladores, zona horaria y ventana. Ante carga de otra página, cambio de cuenta, refresh, cierre de sesión, respuesta tardía, cambio de ventana o navegación, se invalida ese permiso efímero y se oculta inmediatamente la planilla anterior.
- La vista continúa en solo lectura, sin firma, edición, guardado, emisión documental, notificación clínica o acceso a fichas de pacientes.

## Criterios de aceptación
1. Montaje de composición sin red ni consulta de JWT.
2. No mostrar acción por cobertura hasta recibir una fila de la lista personal Edge y vincular Auth; prohibida selección por input libre, deep link o ID manipulado.
3. Seleccionar una fila no dispara lectura de plantilla: la consulta explícita del lector vuelve a validar permisos en Edge.
4. Solo mostrar el ID de una constancia admitida en HC-03A. HTTP 401/403, respuesta malformada o revocación: ocultar estructura, sin plantilla predeterminada.
5. Cambio de sesión, proveedor, ventana, timezone, identidad de controlador o snapshot de paginación: borrar selección previa, detener uso de vistas anteriores, descartar respuestas tardías.
6. No mostrar en interfaz/log datos clínicos, JWT, UUID de paciente/episodio/cobertura ni respuestas upstream.
7. TypeScript estricto, Jest de flujo completo y Quality Gate de cinco trabajos, merge normal + post-main CI.

## Bloqueo preservado
**NO-GO REAL.** Es un arnés de UI de staging sin proyecto remoto, sin SDK operativo y sin pacientes reales. No puede importarse desde `App.tsx` hasta que STAGING-01F-REMOTE certifique con dos organizaciones ficticias identidad+sesión+RLS, se autorice el entorno por Pediatrics y se hayan cotejado las planillas privadas en issue #57.

Este gate completa la composición de pantallas **sin autorizar autenticación o prestaciones clínicas reales**. El circuito seguro operativo depende del staging institucional independiente.

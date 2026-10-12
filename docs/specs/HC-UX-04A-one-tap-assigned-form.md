# HC-UX-04A — Una planilla en un toque para un profesional nuevo

**SPEC/Kiro · 2026-10-11 · GitHub-first · MOBILE_DEMO_ONLY**

## Contexto y problema

El usuario final es un profesional de internación domiciliaria pediátrica que no debe buscar entre seis modelos documentales. Las planillas entregadas por Pediatrics (FORM-001 / HC-03A) son el **resultado esperado**, no un motivo para agregar otra pantalla administrativa. La app móvil tenía ya un acceso desde el detalle de la visita, pero exigía abrir Agenda, elegir visita y volver a navegar por el catálogo. La pantalla principal destacaba explorar la agenda en vez de iniciar la única tarea.

## Requisitos verificados

1. En **Inicio** la acción principal "Abrir mi planilla (demo)" abre la constancia de la **primera prestación pendiente de la agenda ficticia** ordenada por día/hora; los estados ya finalizados no son elegibles como tarea siguiente.
2. La especialidad se obtiene del objeto de prestación **sintético** ya existente y se transmite como único dato para elegir el modelo: **sin** paciente, episodio, domicilio, obra social, profesional, token, diagnósticos ni PDF.
3. Los seis valores de especialidad soportados se asignan exclusivamente a seis constancias de `apps/mobile/src/formPreviewCatalog.json`. Ninguna asignación automática puede abrir evolución, Kardex, signos vitales, procedimientos o crisis.
4. Valores inesperados del runtime (vacíos, desconocidos, `__proto__`, denominaciones similares) **no** abren una planilla por defecto. El selector solo retorna IDs `ATTENDANCE` presentes en el catálogo fuente HC-03A.
5. El modo **enfocado** muestra solo la planilla resultante, una explicación corta de que se eligió automáticamente y el botón "Volver a la agenda", tanto en teléfonos como tabletas. Oculta selector de categorías, listado de seis especialidades y pie del expediente mensual.
6. En modo enfocado con un ID incorrecto, de evolución o papel, mostrar "Planilla no disponible" y ninguna alternativa médica. No filtrar claves sensibles por errores.
7. La pestaña **Planillas** continúa ofreciendo el catálogo completo y las referencias `PAPER_ONLY` solo para revisión de estructuras; no cambia el contrato de formularios, las firmas pendientes ni el índice mensual.
8. Inicio mantiene la agenda completa como enlace **secundario**. Toda la aplicación continúa mostrando DEMO y no guarda nada; ninguna credencial Supabase, documento real o paciente se incorpora a las nuevas pantallas.

## Límites para producción

Esta selección **no representa una autorización clínica** y su conjunto de seis prestaciones sintéticas incluye más de un profesional inventado. En producción, "mi próxima prestación" solo podrá resolverse con Supabase Auth independiente, sesión vigente, asignación profesional autorizada, rol y pertenencia a equipo del episodio, verificados en Edge/RLS; nunca con el texto enviado por el celular.

No se implementa todavía captura editable, evolución médica, PDF, firma de familiar/profesional ni acción de cierre. El cotejo **privado** contra DOCX originales y las 56 páginas de muestra del expediente continúa pendiente en issue #57. Las pruebas automáticas no sustituyen una evaluación de usabilidad humana.

## Verificación y aceptación

- Jest/React Native: Inicio→Kinesiología de la siguiente prestación pendiente sin catálogo; navegación Agenda→Fonoaudiología sin datos del paciente; tablet 1280 px con foco; catálogo libre independiente; valores falsos y prototipo rechazados; ID papel/evolución rechazado sin fallback.
- Contratos HC-03A y los tests previos siguen sin cambios; Quality Gate PostgreSQL RLS, Deno Edge, TypeScript/Jest y JS bundles Android/iOS deben aprobar sin habilitar pacientes.
- PR desde baseline SHA exacto, merge normal y post-main CI **5/5** antes de `CLOSED_CERTIFIED`.
- Siguiente gate funcional: **HC-UX-04B** podrá vincular esta selección a un adaptador de asignación autorizada **solo en staging sintético** una vez que exista un actor/especialidad verificados en el backend. El gate de fuentes originales HC-UX-03B permanece bloqueado por archivos DOCX/PDF privados.

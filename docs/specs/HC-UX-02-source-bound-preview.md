# HC-UX-02 — Planillas fuentes y resultado documental controlado

**SPEC/Kiro · 2026-10-11 · estado: PREVIEW_ONLY / sin servicios clínicos**.

## Objetivo

La prioridad del producto no es solamente la agenda sino que, a partir de una prestación domiciliaria autorizada, la persona acceda automáticamente a su formulario correspondiente y el circuito produzca después la documentación que Pediatrics requiere. El usuario nuevo necesita **una tarea por vez** y no elegir entre múltiples formularios a ciegas.

## Hallazgo y fuentes

La demostración local HC-UX-01 había duplicado manualmente siete listas de etiquetas, con riesgo de divergencia frente a la fuente autorizada. El repositorio contiene el inventario desidentificado `FORM-001`, el contrato `HC-03A`, el código `src/domain/homecare-form-contracts.mjs` y el catálogo de solo lectura `apps/mobile/src/formPreviewCatalog.json`.

En esta ronda no hay archivos originales identificables DOCX ni el PDF privado de 56 páginas disponibles en el repositorio o en los archivos recuperables de este contexto. Su comparación exhaustiva no puede certificarse: **se coteja exclusivamente la estructura de campos confirmados en el inventario y contrato existentes**. No subir originales, nombres de menores, firmas ni scans privados a GitHub.

## Requisitos

1. Una demostración **descargable, autónoma** en `apps/form-prototypes/preview.html`; sin red, fuentes externas, persistencia local, API, Auth ni campos editables clínicos.
2. **Contrato fuente único:** los 7 formularios, encabezados, campos, IDs y clases provienen del catálogo existente `HC-03A`; si cambia el catálogo o el contrato sin actualizar la demo, CI falla.
3. **Seis constancias de asistencia** por profesión; la evolución es un documento clínico distinto y no debe presentarse como firma o conformidad de asistencia.
4. La planilla seleccionada en la demo sigue la prestación ficticia, con un único botón principal por paso: Inicio → Mi planilla → Borrador documental. El selector de profesión existe solo en modo **demo**; el sistema real lo derivará de Auth + asignación y permisos del backend independiente.
5. Toda solicitud de firma familiar/profesional se muestra **PENDIENTE · deshabilitada**; no se capturan firmas, datos de pacientes, condiciones clínicas, órdenes, diagnósticos ni medicación. No hay botón de guardado, aceptación o envío clínico.
6. Enfermería/cuidados conserva explícitamente `Horario` y muestra una guardia nocturna ficticia; no forzar visitas ambulatorias de 40 minutos.
7. Kardex, Signos Vitales, Control de Procedimientos y Hoja de Crisis se muestran **PAPEL** sin convertirlos en formularios activos; no inventar columnas de medicación/umbrales.
8. Expediente mensual 56 páginas: fuente `REFERENCE_ONLY`, **0 documentos emitidos**, índice conceptual; no reconstruir imágenes, foliado, sellos ni firmas.
9. Pruebas Node: catálogo embebido idéntico al mobile, 7 contratos idénticos a source, 4 hojas solo papel, controles de bloqueo. Pruebas en Chrome real: recorrido 6 especialidades y evolución, 1440/768/390 px, sin API ni errores JS, screenshots y fichero HTML como artefacto CI.
10. No tocar migraciones, RLS, Edge, pacientes de CONSULTLAN ni flujo de aprobación clínica en este gate.

## Criterios de aceptación

- 6 + 1 + 4 exactos, con igualdad binaria de sourceLabel/kind/id de cada campo y sin adiciones clínicas independientes.
- Una persona sin conocimientos técnicos puede descargar y abrir el HTML y ver cada planilla en tres pasos.
- Cambio de profesión solo en modo demo; no da acceso real a otras historias ni entidades.
- La impresión/documentación de demostración está señalada como **NO EMITIDO**; no se afirma que coincida en layout con originales ni que sustituya firmas.
- Quality Gate 5/5 para PR HEAD, merge normal, luego 5/5 sobre SHA nuevo de main antes de `CLOSED_CERTIFIED`.
- **HC-UX-02_ORIGINAL_SOURCE_PARITY_PENDING** queda explícito hasta poder cotejar privately contra DOCX/PDF originales y contar con la aprobación funcional de Pediatrics.

## Qué falta para resultados reales

**HC-UX-03:** comparar en un entorno privado cada plantilla original contra la salida, decidir campos exigibles por obra social, conservar hoja física y resolver aceptación/rechazo de adulto autorizado, identidad, firma profesional, versiones, rectificaciones, conservación privada y concatenación/folio del expediente mensual. **Solo entonces** se diseñan captura editable y emisión en Supabase autónomo.

No se habilita la app con menores, PDFs jurídicamente válidos ni almacenamiento clínico en este gate.

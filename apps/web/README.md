# WEB-COORD-02 — React + TypeScript: candidato de coordinación (sin conexión)

Esta es la **primera consola por componentes** del proyecto de internación domiciliaria, inspirada en la alternativa **C / híbrida**, pero **su selección institucional sigue pendiente**. Es una pantalla navegable sin pacientes reales ni backend, no la consola para operar un servicio médico.

## Verla sin conocimientos de programación

Cuando el PR haya superado GitHub Actions, abrir **Actions → Quality Gate → Browser QA for synthetic web A/B/C → artifacts → web-coord-qa-…** y descargar el artefacto. Extraer el ZIP, abrir `apps/web/dist/preview.html` mediante doble clic en Chrome/Edge/Safari/Firefox. El archivo contiene el código y los estilos; no necesita Node, cuenta, claves, red ni Supabase. Si el archivo no figura, el PR no está certificado para compartir esa versión.

Para desarrollo técnico: desde esta carpeta ejecutar `npm install`, `npm run dev` o `npm run build` (que genera `dist/preview.html` autónomo). No se guarda ningún dato al cerrar.

## Flujos de la propuesta C

- **Resumen:** indicadores y alertas que requieren intervención humana (dos coberturas sin asignación y un relevo pendiente).
- **Agenda:** vista semanal con la misma guardia 20:00–08:00 presente en lunes y martes, sin duplicar su identidad, además de vista 24 horas y filtro por especialidad.
- **Episodios:** cuatro casos con códigos sintéticos y detalles de organización, sin identidad ni historia clínica.
- **Profesionales:** cinco perfiles ficticios, sin declarar matrícula verificada.
- **Relevos:** cambios de guardia pendientes; confirmar/aprobar está deshabilitado.
- **Reportes:** totales ilustrativos, sin conciliación facturable, firma ni documentos emitibles.
- **Control documental:** simulación de cierre mensual con 8 documentos inventados, control de fecha/firma/conformidad/corrección/escaneo, filtros, observaciones y **cierre siempre deshabilitado**. No presupone prestaciones realizadas ni el régimen legal de firmas.

## Controles de calidad

- Contrato `src/data.ts` con 13 coberturas, 4 episodios, 5 profesionales, 9 visitas y 4 guardias.
- `src/App.tsx` implementa navegación accesible mediante botones, selectores nativos, un diálogo nativo y tabla; `src/DocumentControl.tsx` agrega control documental sintético basado en funciones puras de `src/documentReadiness.ts`; CSS responsive 320–1440 px.
- CI construye React/TypeScript y el HTML offline, prueba navegación y guardias nocturnas en **Chrome (1440/768/390/320 px), Firefox y WebKit (768/390 px)** y audita WCAG con axe-core en Chrome. Comprueba cero solicitudes externas y cero acciones clínicas habilitadas.
- No hay `fetch`, SDK Supabase, `localStorage`, tokens, login, importación de pacientes ni vías de escritura.
- Guía de aceptación y restricciones: [`WEB-COORD-05`](../../docs/specs/WEB-COORD-05-document-readiness-demo.md). Los estados "sin observaciones" son reglas de demo, nunca autorización de presentación.
- La identidad CONSULTLAN es solo visual; no comparte servidor, cuentas ni datos con Pediatrics ambulatorio.

## Limitaciones bloqueantes

**NO-GO PRODUCCIÓN.** Coordinación/Pediatrics debe comparar el prototipo React C con A/B/C, aprobar o solicitar cambios, definir permisos operativos y validez clínica/administrativa, y autorizar exclusivamente un staging Supabase autónomo con identidades sintéticas para integración real. Los originales DOCX/PDF y expediente mensual siguen pendientes de cotejo privado (issue #57). No considerar los cambios en GitHub como aprobación médica, legal ni de seguridad de un sistema con pacientes.

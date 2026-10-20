# WEB-COORD-05 — Control documental mensual para la demo de Pediatrics

**SPEC/Kiro · 2026-10-20 · implementación de candidato React 100% offline y sintético**

## Contexto
Pediatrics describió un problema operativo concreto de internación domiciliaria: las historias físicas quedan en las casas, las evoluciones pueden llegar a fin de mes sin firma, fecha legible o digitalización, y Coordinación no logra preparar la documentación en plazo. El usuario decidió **mostrar un demo antes de configurar Supabase**.

Referencias investigadas: Folk Care (módulos `visit-notes`, `clinical-documentation` y `quality-assurance-audits`), OpenEMR, Medplum y DocuSeal. Se retomaron **ideas de interacción y controles**, sin incorporar código de esos proyectos. Atención especial: Folk Care y DocuSeal son AGPL-3.0; no se autoriza copiar código o componentes por este SPEC ni atribuir cumplimiento legal argentino a implementaciones de otros países.

## Alcance de esta etapa
Crear una sección nueva **Control documental** dentro de `apps/web` para demostrar:
1. Un período fijo ficticio, **octubre de 2026**, con 8 documentos independientes, ninguno relacionado con un paciente existente.
2. Comprobación calculada y explicable de fecha de prestación, firma profesional de ejemplo, conformidad del cuidador **solo si una regla ficticia la pide**, corrección pendiente y digitalización por escáner pendiente.
3. Asociación con una cobertura y episodio sintéticos ya definidos en `data.ts` sin interpretar `status=Confirmada` como atención prestada.
4. Cuando la cobertura referenciada no existe, tiene otro episodio/especialidad o carece de profesional, fallar **cerrado**, sin declarar un documento completo.
5. Una guardia nocturna de dos días no se transforma en dos documentos ni duplica pendientes.
6. Contadores y filtros locales por episodio y estado. Un botón **Ver pendientes** abre solo la lista de faltantes, sin escribir datos.
7. Detalle por documento que explique qué requisitos faltan en lenguaje sencillo; diseños accesibles 320/390/768/1440 px y navegación con teclado.
8. Cierre/firmas/exportaciones **siempre deshabilitados**. Ni la totalidad de reglas marcadas como sin observaciones significa firma válida, historia completa, aprobación de Coordinación, autorización de obra social o paciente real.

## Exclusiones deliberadas
No hay carga de evolución clínica, edición de fechas, garabatos de firma, escaneo, OCR, PDF real, sincronización offline, Storage, cambios de servidor, Auth o Supabase. Los ejemplos de conformidad de cuidadores **no son decisiones sobre quién debe firmar en Argentina**. El representante legal legítimo mantiene sus derechos de acceso, aunque el sistema futuro custodie la historia clínica fuera del hogar.

## Calidad exigida
- `documentFindings` y `monthlyDocumentSummary` puros, sin dependencias externas ni estado persistente.
- Fixture de 8 documentos: 5 observados (uno por falta de firma profesional, conformidad, fecha, corrección o escaneo) y 3 sin observaciones ilustrativas.
- E2E del `dist/preview.html` autónomo en Chrome/Firefox/WebKit: abrir sección, filtros 8 → 5 → 2 → 1 → 8, una única fila de guardia nocturna, bloqueo de cierre, cero HTTP y cero excepciones.
- Auditoría `axe-core` sobre nueva sección en Chrome 1440/390; revisar sin producir recursos externos.
- Cinco jobs del Quality Gate, merge normal con SHA inmutable y CI posmerge en `main`.

## Siguiente etapa — pendiente de Laura y autorización institucional
Cotejar originales de planillas y expedientes, definir qué firma y constancia corresponden a cada servicio, políticas de corrección mediante adendas auditables, responsabilidad del cierre, autorización del paciente/representante, conservación/entrega, firma electrónica/digital aplicable, tareas pendientes antes de terminar el mes y generación final. El backend deberá validar todo sobre un Supabase independiente con registros sintéticos, RLS y sesiones reales antes de habilitar escritura clínica.

**NO-GO uso asistencial real.** Esta es la primera demostración interactiva del control mensual, no una aplicación clínica lista para operar.

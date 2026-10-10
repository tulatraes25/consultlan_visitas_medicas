# HC-03A — Contrato de formularios derivado de planillas originales de Pediatrics

**SPEC/Kiro | Estado:** GitHub-first, contract-only, pendiente de certificación CI (2026-10-10).
**Fuente funcional:** [FORM-001](FORM-001-inventario-clinico.md), elaborado con el material recibido del servicio de internación domiciliaria. PDF mensual original de 56 páginas escaneadas: revisión estructural, **no transcripción completa ni OCR**, no importación de pacientes/firma.

## Objetivo y límites

Preservar el proceso solicitado por Pediatrics: prestación en casa, control del profesional, conformidad del padre/madre/tutor/cuidador autorizado según verificación de su vínculo y registro por especialidad. **No** convertir las hojas físicas de Kardex, signos vitales, procedimientos o crisis en formularios clínicos activos.

El programa de internación domiciliaria es independiente de los pacientes/consultorios de Pediatrics. Cualquier identificador de paciente y prestación será provisto por el servidor propio a partir del episodio vigente, nunca por una clave de CONSULTLAN.

La referencia de los formularios es su **estructura verificada**, no un permiso para almacenar información médica de un menor, tomar firmas legalmente válidas ni presentar órdenes que no existan.

## Definiciones implementadas

`src/domain/homecare-form-contracts.mjs` contiene **siete contratos** inmutables:

| Código | Fuente verificada | Campos de fila confirmados |
|---|---|---|
| MEDICAL_ATTENDANCE | Planilla médica | Fecha; firma profesional; firma padre/madre/tutor |
| NURSING_CAREGIVER_ATTENDANCE | Enfermería/cuidadoras | Fecha; horario; firma y sello profesional; firma familiar |
| PHYSIOTHERAPY_ATTENDANCE | Kinesiología | Fecha; firma kinesiólogo; firma familiar |
| SPEECH_ATTENDANCE | Fonoaudiología | Fecha; firma especialista; firma familiar |
| OCCUPATIONAL_THERAPY_ATTENDANCE | Terapia ocupacional | Fecha; firma especialista; firma familiar |
| NUTRITION_ATTENDANCE | Nutrición | Fecha; firma y sello profesional; firma tutor |
| CLINICAL_EVOLUTION | Hoja evolución | Narrativa de evolución separada de la asistencia |

Los encabezados de paciente y obra social se mantienen como **contexto del episodio**, no campos de texto libre editables en cada firma. Los encabezados «fecha de hoja» se representan solo en las plantillas donde su estructura fue verificada. Enfermería/cuidadoras puede corresponder a **guardias prolongadas** en HC-02A, no a citas rígidas de consultorio.

Las firmas de profesional y responsable son **solicitudes conceptuales de evidencia por documento y versión**, no imágenes estampadas reutilizables. Una firma con lápiz en la pantalla no constituye por sí misma una firma digital certificada. Ningún contrato activa registro, almacenamiento, cierre ni firma.

## Documentación que debe permanecer en domicilio

`BEDSIDE_PAPER_RECORDS` recoge referencias (no formularios digitales ejecutables) a:
- KARDEX: solo rótulos legibles «Paciente» y «Medicación»; columnas ilegibles pendientes, **nunca** inferir dosis/vía/frecuencia.
- VITAL_SIGNS: se mantienen referencias a los encabezados visuales conocidos (SpO2, FC, FR, temperatura, T/A y otros), sin inferir rangos, diagnósticos ni alertas.
- PROCEDURE_SHEET: tabla de control de procedimientos; ejemplos de prácticas en origen no implican un catálogo clínico cerrado.
- CRISIS_SHEET: fecha, tipo de crisis y duración; la app no monitorea emergencias ni prescribe respuestas.

`MONTHLY_DOSSIER` registra únicamente la existencia del PDF escaneado de 56 páginas como antecedente documental. No guarda ni reproduce sus firmas ni datos clínicos. Permanece pendiente la concordancia campo por campo con las imágenes originales y aprobación institucional.

## Contrato de seguridad y aceptación

La función pura `inspectFormPreviewRequest` **solo acepta PREVIEW_STRUCTURE** de un contrato verificado o REFERENCE_PAPER_RECORD de una hoja que queda en casa. Rechaza:
- identidad o código de paciente de consultorios de Pediatrics;
- nombres, datos clínicos, imágenes de trazos, llaves privadas, firmas precargadas;
- intento de presentar documentos como certificados o de cerrar un expediente;
- intento de digitalizar los cuatro registros físicos sin criterio médico;
- códigos desconocidos o acciones no aprobadas.

Esta función es un **guard de previsualización**, NO la autorización de bases de datos o de una firma. No habilita writes ni se conecta a Supabase.

CI incorpora pruebas Node de los siete formularios, el control de seis tipos de constancia de asistencia, separación de evolución, campos verificados, la inmutabilidad del catálogo y rechazo de entradas clínicas o documentos físicos. Conserva los tests HC-02B, PostgreSQL, Deno y Expo.

## Gate siguiente (HC-03B)

Diseñar las pantallas móviles de previsualización y captura segura **solo en memoria con datos sintéticos**, respetando los campos de estas hojas. La estructura final, los datos obligatorios de la obra social y el orden de captura/firma se definirán con la supervisión médica/administrativa.

Antes de activar persistencia en Supabase, faltan HC-02C (habilitación profesional, aprobación clínica, admisión/alta), firmas de familiares con verificación de representación, firma digital profesional y repositorio privado de documentos con auditoría y versión.

El alcance de HC-03A es **contrato estructural fiel a la evidencia disponible**; no es digitalización certificada de planillas ni puesta en producción.

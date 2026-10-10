# FORM-001 — Inventario de formularios de internación domiciliaria
Estado: REVISADO ESTRUCTURALMENTE; pendiente validación funcional por Pediatrics (2026-10-10).

## Fuente y privacidad
Material privado recibido para analizar el proceso. No subir planillas originales, expedientes, imágenes, firmas ni pacientes a GitHub. El PDF mensual original tiene 56 páginas A4 escaneadas; ninguna posee capa de texto extraíble. Se revisó su estructura por miniaturas y muestras representativas, **no se transcribió información clínica ni se realizó OCR**. Su uso es referencia del proceso, nunca fixture de test.

## Documentos recibidos
| Plantilla | Campos verificados | Observación |
|---|---|---|
| Planilla médica | Paciente, OS, fecha; por fila fecha, firma profesional y firma padre/madre/tutor | Constancia, no equivale por sí misma a evolución clínica |
| Enfermería/cuidadoras | Paciente, OS, fecha; por fila fecha, horario, firma y sello profesional, firma familiar | Dos ejemplares de tabla por archivo |
| Kinesiología | Paciente, OS, fecha; fecha, firma kinesiólogo, firma familiar | Ejemplares duplicados |
| Fonoaudiología | Paciente, OS, fecha; fecha, firma especialista, firma familiar | Confirmar qué se considera prestación válida |
| Terapia ocupacional | Paciente, OS, fecha; fecha, firma especialista, firma familiar | No agregar campos clínicos sin aprobación |
| Nutrición | Paciente, OS; fecha, firma y sello, firma tutor | Firma de adulto no sustituye firma de profesional |
| Hoja evolución | Paciente, fecha, OS; área de evolución abierta | Mantener registro clínico separado de asistencia |
| Control procedimientos | Paciente, OS; fecha, horario, procedimiento, firma profesional; menciones cánula E.T., botón, SNG y otros | Lista de prácticas ilustrativa, no catálogo clínico definitivo |
| Hoja de crisis | Fecha, tipo de crisis, duración | No contiene por sí sola definición de severidad o pauta de respuesta |
| Signos vitales | Paciente, FECHA, HORARIO, SPO2, FC, FR, T°, T/A, FIRMA Y SELLO | Verificado visualmente en dos páginas renderizadas |
| Ficha Kardex | Paciente, Medicación y grilla con varias columnas de encabezado no legible/no rotulado | Verificado visualmente desde su imagen EMF extraída; no interpretar las demás columnas como dosis, vía u horario |
| PDF mensual (56 págs.) | Secuencias de planillas, evoluciones y documentación complementaria escaneada y firmada | No copiar contenido identificable ni firmas; se requieren criterios de archivo, foliado y conciliación |

## Hallazgos de formato
- La ficha Kardex está encapsulada en gráficos PNG/EMF. Su exportación convencional a PDF de LibreOffice superpone elementos. La inspección aislada del EMF confirma el rótulo «Medicación», pero no los restantes encabezados; **no declarar el Kardex digital especificado**.
- Signos Vitales es otra plantilla gráfica, pero la representación visual muestra de manera legible sus ocho columnas.
- El expediente mensual ilustra que firmas y sellos se incorporan repetidamente a evoluciones y planillas; en digital será necesaria una nueva evidencia por documento/versión, no una imagen reutilizada de la firma.
- Las planillas de asistencia no sustituyen por sí mismas evolución médica, orden de tratamiento, consentimiento informado ni un documento firmado digitalmente.

## Matriz de campos mínima propuesta (sin inventar datos clínicos)
1. La VISITA registra patientRef, professionalRef, specialty, fecha/intervalo, estado, identificador de asignación y versión.
2. La CONSTANCIA DE ASISTENCIA documenta la prestación, rango horario, profesional y resultado de firma del adulto/representante: FIRMADA, RECHAZADA o NO DISPONIBLE, con motivo en los últimos dos.
3. La EVOLUCIÓN clínica guarda tipo de prestación, texto/observaciones autorizadas y relación con la visita; se firma según el circuito legal aprobado.
4. El CONTROL DE SIGNOS VITALES, si Pediatrics exige digitalizarlo, contempla saturación SpO2, FC, FR, temperatura y tensión arterial con unidades clínicas explícitas y rangos validados por equipo clínico, no por ingeniería.
5. El KARDEX permanece físico en la primera versión hasta especificar la semántica de columnas, circuitos de indicación y administración y responsable de actualización.

## Cuestiones abiertas que requieren validación funcional
- Quién está autorizado para firmar asistencia: padre, madre, tutor legal, cuidador autorizado; cómo se acredita autorización.
- Qué aporta la obra social o auditor médico al comprobante; periodicidad y formato de rendición.
- Si pediatrics necesita digitalización espejo de planillas de domicilio o solo evidencia del acto y sus firmas.
- Proveedor y procedimiento de firma digital de profesionales; régimen de guarda y rectificación.
- Qué campos son obligatorios por especialidad y qué formatos/valores exige cada cobertura.

## Condición de aceptación
Aprobación del responsable médico y de administración de Pediatrics antes de implementar captura y almacenamiento definitivo de cada formulario clínico.

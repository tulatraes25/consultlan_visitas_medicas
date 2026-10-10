# SPEC 001 - CONSULTLAN Visitas Medicas
Estado: PROPOSED / discovery. Fecha: 2026-10-10.
Baseline del repositorio: db688fad41539d0b239a5f6b3194001ca306c875.

## Objetivo
Aplicacion movil y tablet para prestaciones de internacion domiciliaria de Pediatrics (medicos, enfermeria, cuidadores, kinesiologia, fonoaudiologia, terapia ocupacional, nutricion y especialidades futuras). UI coherente con CONSULTLAN, sin copiar historia clinica ni base operativa completa.

## Fuentes funcionales
Solicitud de Pediatrics y paquete documental recibido por privado: planillas medica, kines, fono, T.O., nutricion, asistencia enfermeria/cuidadores, hoja de evolucion, kardex, signos vitales, control procedimientos, hoja de crisis y dossier mensual de 56 paginas. **No incorporar documentos reales, datos identificables, firmas o scans al repositorio.** Se requieren fixtures sinteticos antes de convertir campos.
Pediatrics indica que kardex, signos vitales, procedimientos y hoja de crisis permanecen en domicilio: la app NO debe afirmar sustitucion de soporte fisico. Definir que registros permanecen en papel y que datos digitales son obligatorios por practica y obra social.

## Requisitos V1
R01: acceso individual, roles profesionales, coordinacion, auditoria, administracion. Minimo privilegio, MFA a evaluar, aislamiento entre pacientes.
R02: asignacion de pacientes y visitas con fecha, franja horaria, tipo de prestacion, profesional y estado; evitar asignaciones duplicadas, cancelaciones auditadas.
R03: agenda del profesional, detalle del paciente con informacion clinica minima necesaria, acceso solo por asignacion legitima.
R04: inicio/fin de visita registrado por servidor; discrepancias horarias y excepciones auditadas. Geolocalizacion SOLO si existe necesidad concreta, consentimiento/base legal y politica proporcional.
R05: formularios especificos por especialidad con version, campos estructurados, validaciones y narrativa clinica; registro de rechazos, no realizacion e incidentes.
R06: conformidad de adulto responsable o cuidador identificado: ver resumen, declarar caracter, firma electronica trazable o rechazo/no disponible, sin firmas precargadas/reutilizadas. No confundir firma dibujada con firma digital legal.
R07: firma profesional para documentos sanitarios mediante mecanismo de firma digital valido bajo Ley 25.506 cuando corresponda; evaluar integracion con certificador licenciado. NO almacenar claves privadas de profesionales en la app ni simular firma digital con sello PNG.
R08: documento canonico generado en servidor, timestamp, version, hash SHA-256, evidencia de firma y registro de auditoria append-only; correccion por addendum, nunca sobrescribir documento cerrado.
R09: datos locales cifrados y minimizados para conectividad limitada; sincronizacion idempotente con deteccion de conflictos; un cierre offline no es cierre validado.
R10: backend y base propia, API de CONSULTLAN con privilegios minimos y autentificacion de servicio; no acceso SQL cruzado directo. Integracion requiere contrato estable aprobado.
R11: panel administrativo movil/tablet para coordinacion y altas segun roles, sin depender de acceso al servidor; analizar si recepcion existente gestiona asignaciones.
R12: exportacion de prestaciones firmadas y conciliacion por periodo, profesional, especialidad, paciente y cobertura. Reportes sin exponer datos innecesarios.
R13: interfaz para smartphone y tablet Android/iOS con accesibilidad, controles tactiles y sistema visual extraido del frontend CONSULTLAN, sujeto a auditoria precisa.

## Requisitos no funcionales / blockers
N01: resguardar datos de salud sensibles. No datos reales en GitHub, ejemplos, logs de CI, capturas ni canales publicos.
N02: test unitarios/integracion/contratos, permission matrix deny-by-default, pruebas de seguridad y sincronizacion offline, QA en Android e iOS.
N03: confirmar politica de consentimiento, guarda documental, roles legales y disposiciones de ley 25.326, 26.529, 25.506, 27.706 y regulacion local aplicable antes de produccion.
N04: verificar flujos de firma con asesor juridico sanitario y obras sociales; distinguir evidencia de conformidad de consentimiento informado clinico.
N05: no almacenar imagen de firma del profesional para aplicarla automaticamente a registros posteriores.
N06: posibilidad de revocacion de sesiones, perdida de dispositivo, backup cifrado, recuperacion, retention y auditoria.

## Modelo de dominio propuesto
PatientRef (identificador externo pseudonimo), CaregiverIdentity, Professional, Assignment, Visit, FormTemplate, FormSubmission, Observation, Intervention, VisitEvidence, SignatureRequest, SignatureEvidence, SignedDocument, AuditEvent, SyncOperation, Attachment.
FHIR mapping orientativo: Patient, RelatedPerson, Practitioner, Encounter, Observation, Procedure, QuestionnaireResponse, DocumentReference, Provenance, AuditEvent. No adoptar FHIR completo sin dimensionar interoperabilidad.

## Flujo
COORDINACION asigna visita -> PROFESIONAL ve su agenda -> registra llegada y prestaciones -> presenta resumen al ADULTO RESPONSABLE -> captura conformidad/negativa y evidencia -> valida/firma documento profesional segun marco aplicable -> servidor emite cierre, PDF, hash y auditoria -> coordinacion concilia. Cierre pendiente de firma/sync se distingue visual y logicamente de cerrado verificado.

## Arquitectura candidata (pendiente de ADR)
React Native + Expo + TypeScript; API nueva con identidad federada (decidir proveedor); PostgreSQL aislado, almacenamiento de documentos cifrado, cola outbox para sincronizacion y proveedor de firma digital. Extraer tokens visuales de src/frontend/web-next del CONSULTLAN real. Mantener app movil sin backend expuesto directamente a la red privada de CONSULTLAN.
Alternativas a evaluar: PWA offline vs React Native; Kotlin Multiplatform; Medplum/FHIR completo vs modelo propio con adaptadores.

## Referencias inspeccionadas
- https://github.com/medplum/medplum
- https://github.com/medplum/medplum-patient-intake-demo
- https://github.com/openemr/openemr
- https://github.com/niko4244/openfieldpro
- https://github.com/vintasoftware/medplum-chat-app
Inspiracion metodologica, NO dependencia ni copia de codigo sin auditoria de licencias, vulnerabilidades y mantenimiento.

## GATE 0 criterios de aceptacion
- [ ] Inventariar todos los campos obligatorios de los DOCX; auditoria visual de las 56 paginas escaneadas con datos privados en entorno controlado.
- [ ] Aprobar matriz rol-accion y alcance por especialidad con Pediatrics.
- [ ] Aprobar contrato de integracion y politica de no duplicacion de historia clinica.
- [ ] Resolver decision legal/tecnica de firma electronica y firma digital.
- [ ] Extraer tokens de estilo del CONSULTLAN real y crear ADR mobile.
- [ ] Configurar CI y fixtures sinteticos, sin secretos ni datos reales.
- [ ] Definir UAT con al menos un recorrido por especialidad, rechazo de firma, offline/reintento y correccion por addendum.

## Limitaciones actuales
Este documento es una especificacion inicial, NO implementacion ni certificacion clinica, juridica o de seguridad. El PDF escaneado de 56 paginas aun no ha sido auditado campo por campo. Las decisiones de stack son propuestas. La integracion existente de CONSULTLAN no se modifica en esta etapa.

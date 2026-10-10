# SPEC-001 — Programa de internación y cuidados domiciliarios pediátricos
Estado: CONTEXT_RESCOPED_HC00 / discovery clínico. Fecha: 2026-10-10. ADR-003 prevalece sobre el paradigma de agenda ambulatoria.
Baseline del repositorio: db688fad41539d0b239a5f6b3194001ca306c875.

## Objetivo
Aplicación móvil y tablet para un programa DIFERENTE de pacientes: internación y cuidados domiciliarios pediátricos de posible alta complejidad, incluyendo enfermedades graves y crónicas según evaluación profesional. No confundir con población, agenda ni atención ambulatoria de la clínica Pediatrics. La unidad principal es un EPISODIO longitudinal de internación en el hogar; visitas puntuales, turnos extendidos de cuidado, relevos y registros pertenecen a ese episodio. Stack AUTÓNOMO: Supabase Auth/PostgreSQL/Storage/Edge Functions propios. CONSULTLAN solo aporta referencia visual; no comparte ni importa datos, pacientes, profesionales, sesiones, API ni historias clínicas.

## Fuentes funcionales
Solicitud de Pediatrics y paquete documental recibido por privado: planillas medica, kines, fono, T.O., nutricion, asistencia enfermeria/cuidadores, hoja de evolucion, kardex, signos vitales, control procedimientos, hoja de crisis y dossier mensual de 56 paginas. **No incorporar documentos reales, datos identificables, firmas o scans al repositorio.** Se requieren fixtures sinteticos antes de convertir campos.
Pediatrics indica que kardex, signos vitales, procedimientos y hoja de crisis permanecen en domicilio: la app NO debe afirmar sustitucion de soporte fisico. Definir que registros permanecen en papel y que datos digitales son obligatorios por practica y obra social.

## Requisitos V1
R01: acceso individual, roles profesionales, coordinacion, auditoria, administracion. Minimo privilegio, MFA a evaluar, aislamiento entre pacientes.
R02: admisión en EPISODIO domiciliario propio, plan de cuidados y responsable clínico; asignación de coberturas/turnos extendidos Y visitas puntuales con equipo, tipo de prestación, fecha/intervalo y estado. Detectar solapamientos, faltantes de cobertura, relevos y cancelaciones auditadas. Una visita no puede existir como hecho asistencial sin pertenecer al episodio del mismo paciente.
R03: agenda de cobertura domiciliaria y visitas del profesional; expediente del EPISODIO con acceso clínico mínimo según rol, equipo y asignación activa. Administración no accede a evoluciones por defecto. Nunca mostrar pacientes de consultorio Pediatrics.
R04: inicio/fin de visita registrado por servidor; discrepancias horarias y excepciones auditadas. Geolocalizacion SOLO si existe necesidad concreta, consentimiento/base legal y politica proporcional.
R05: formularios por especialidad y tipo de trabajo (visita puntual, guardia/cobertura, entrega de turno, evolución, constancia de asistencia e incidente), sujetos a validación por Dirección Médica; no presuponer que todas las planillas de domicilio se sustituyen. Sin criterios clínicos o dosificaciones definidos por ingeniería.
R06: conformidad de adulto responsable o cuidador identificado: ver resumen, declarar caracter, firma electronica trazable o rechazo/no disponible, sin firmas precargadas/reutilizadas. No confundir firma dibujada con firma digital legal.
R07: firma profesional para documentos sanitarios mediante mecanismo de firma digital valido bajo Ley 25.506 cuando corresponda; evaluar integracion con certificador licenciado. NO almacenar claves privadas de profesionales en la app ni simular firma digital con sello PNG.
R08: documento canonico generado en servidor, timestamp, version, hash SHA-256, evidencia de firma y registro de auditoria append-only; correccion por addendum, nunca sobrescribir documento cerrado.
R09: datos locales cifrados y minimizados para conectividad limitada; sincronizacion idempotente con deteccion de conflictos; un cierre offline no es cierre validado.
R10: proyecto Supabase totalmente independiente, con Auth y datos propios. Acceso por RLS por organizacion y profesional asignado; Edge Functions para operaciones privilegiadas, con chequeos server-side. NO usar API ni credenciales de CONSULTLAN, NO sincronizar datos clinicos automaticamente.
R11: panel propio de administracion/coordinacion en la app; gestion desde cero de pacientes, profesionales, invitaciones Auth, especialidades y asignaciones. Nunca asumir que el rol de recepcion de CONSULTLAN confiere permisos aqui.
R12: exportacion de prestaciones firmadas y conciliacion por periodo, profesional, especialidad, paciente y cobertura. Reportes sin exponer datos innecesarios.
R13: interfaz para smartphone y tablet Android/iOS con accesibilidad, controles tactiles y sistema visual extraido del frontend CONSULTLAN, sujeto a auditoria precisa.

## Requisitos adicionales de internación domiciliaria (ADR-003)

R14: `HomeCareEpisode` con admisión, equipo de referencia, plan vigente, continuidad y egreso; no permitir que una visita de paciente A se asocie a episodio de paciente B.
R15: `CarePlanVersion` y órdenes médicas con identidad del profesional responsable, vigencia, revisión y versiones inmutables; no inventar decisiones clínicas, dosis ni indicaciones.
R16: distinguir cobertura prolongada (`CareShift`) de visita puntual (`HomeVisit`); planificar reemplazos y relevos verificables, con períodos superpuestos y ausencias explicitados.
R17: seguimiento interdisciplinario con mínimo privilegio por episodio, pertenencia al equipo y necesidad de acceso; perfiles operativos no equivalen a permisos de lectura clínica.
R18: `ClinicalEvent` y avisos a responsables asistenciales con confirmación de recepción; ni la app ni sus notificaciones sustituyen los canales de urgencias.
R19: representar familiares, tutores y cuidadores autorizados como personas y alcances DIFERENTES de profesionales de la salud y de quien firma constancia de asistencia.
R20: conservar Kardex, hoja de crisis, control de procedimientos y signos vitales en domicilio mientras Pediatrics así lo disponga; app puede registrar referencia, nunca presentar copias parciales como reemplazo del original.
R21: planificar conciliación por episodio, cobertura profesional, prestación, responsable y obra social; la rendición administrativa no autoriza lectura indiscriminada de evolución.
R22: proteger diagnósticos graves y situaciones familiares sensibles de niñas, niños y adolescentes; nunca publicar material real en código, CI, capturas ni datos de demostración.
R23: soportar transferencias, reinternaciones y egreso sin autocierre por ausencia de visitas; validación humana y trazabilidad son requisitos para los cambios longitudinales.

## Requisitos no funcionales / blockers
N01: resguardar datos de salud sensibles. No datos reales en GitHub, ejemplos, logs de CI, capturas ni canales publicos.
N02: test unitarios/integracion/contratos, permission matrix deny-by-default, pruebas de seguridad y sincronizacion offline, QA en Android e iOS.
N03: confirmar politica de consentimiento, guarda documental, roles legales y disposiciones de ley 25.326, 26.529, 25.506, 27.706 y regulacion local aplicable antes de produccion.
N04: verificar flujos de firma con asesor juridico sanitario y obras sociales; distinguir evidencia de conformidad de consentimiento informado clinico.
N05: no almacenar imagen de firma del profesional para aplicarla automaticamente a registros posteriores.
N06: posibilidad de revocacion de sesiones, perdida de dispositivo, backup cifrado, recuperacion, retention y auditoria.

## Modelo de dominio propuesto
HomeCarePatient (UUID exclusivo del programa, sin identificador de clínica), HomeCareEpisode, CarePlanVersion, MedicalOrderVersion (solo profesional autorizado), CareTeamMembership, Professional (Auth UID propio), OrganizationMembership, CareShift, ShiftHandover, HomeVisit, CaregiverIdentity/Authorization, ClinicalEvent/EscalationAcknowledgment, BedsidePaperRecord, FormTemplate, FormSubmission, Observation, Intervention, AttendanceAttestation, SignatureEvidence, SignedDocument, AuditEvent, SyncOperation, Attachment.
FHIR mapping orientativo: Patient, RelatedPerson, Practitioner, Encounter, Observation, Procedure, QuestionnaireResponse, DocumentReference, Provenance, AuditEvent. No adoptar FHIR completo sin dimensionar interoperabilidad.

## Flujo
ADMISIÓN en episodio -> DIRECCIÓN MÉDICA aprueba plan/indicaciones -> COORDINACIÓN programa coberturas prolongadas y visitas -> PROFESIONAL asignado registra atención/evolución/relevo e incidentes según su función -> RESPONSABLE legitimado recibe información y confirma asistencia cuando corresponda (no sustituye consentimiento) -> se valida el documento y firma del profesional según mecanismo legal -> SERVIDOR guarda versiones/auditoría -> COORDINACIÓN concilia, verifica continuidad de cuidados y gestiona egreso. Un incidente clínico exige canales humanos habilitados; la app NO sustituye urgencias ni confirma atención de emergencias.

## Arquitectura decidida (ADR-002)
React Native + Expo + TypeScript y proyecto Supabase autónomo: Auth, PostgreSQL, RLS, Edge Functions y Storage privado (pendiente). Pacientes, profesionales y episodios se registrarán desde cero exclusivamente para internación domiciliaria. Las claves privilegiadas quedan en funciones server-side. NO hay conexión técnica, usuarios compartidos ni importaciones automáticas del servidor Pediatrics/CONSULTLAN. El esquema SUPA-01 de visitas es un prototipo de base: HC-01 deberá agregar episodio, plan y pertenencia antes de uso clínico.

## Referencias inspeccionadas
- https://github.com/medplum/medplum
- https://github.com/medplum/medplum-patient-intake-demo
- https://github.com/openemr/openemr
- https://github.com/niko4244/openfieldpro
- https://github.com/vintasoftware/medplum-chat-app
Inspiracion metodologica, NO dependencia ni copia de codigo sin auditoria de licencias, vulnerabilidades y mantenimiento.

## Contexto rector y aprobaciones clínicas

La referencia principal es **ADR-003**. El plan de cuidados, tipos de guardia, autorizaciones por equipo, protocolos de derivación y formularios se validarán con Dirección Médica de la unidad de internación domiciliaria. Un sistema de turnos habitual no cubre estas obligaciones. La Resolución MS 704/2000 sirve como referencia normativa inicial, pendiente de revisión jurisdiccional y asesoría jurídica.

## GATE 0 criterios de aceptacion
- [ ] Inventariar todos los campos obligatorios de los DOCX; auditoria visual de las 56 paginas escaneadas con datos privados en entorno controlado.
- [ ] Aprobar matriz rol-accion y alcance por especialidad con Pediatrics.
- [x] Rechazar integracion con CONSULTLAN: arquitectura 100% independiente en Supabase (ADR-002).
- [ ] Resolver decision legal/tecnica de firma electronica y firma digital.
- [ ] Extraer tokens de estilo del CONSULTLAN real y crear ADR mobile.
- [ ] Configurar CI y fixtures sinteticos, sin secretos ni datos reales.
- [ ] Definir UAT con al menos un recorrido por especialidad, rechazo de firma, offline/reintento y correccion por addendum.

## Limitaciones actuales
Este documento es una especificación evolutiva, NO certificación clínica, jurídica o de seguridad. El PDF escaneado de 56 páginas aún no fue auditado campo por campo. El diseño técnico actual de visitas, horarios fijos y alta de pacientes mediante códigos de muestra es DEMO, no un sistema de internación de alta complejidad completo. Faltan episodio longitudinal, planes e indicaciones validados, permisos por equipo, turnos de cuidado, relevos y contingencias aprobados, firmas, configuración del Supabase propio y QA asistencial. Nunca se copiarán pacientes de la clínica.

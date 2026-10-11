# OSS-HC-ARCH-01 — Auditoría comparativa de arquitecturas de GitHub

**Fecha del relevamiento:** 2026-10-11. **Estado:** evaluación técnica de repositorios públicos, no prueba de seguridad ni certificación médica. **Alcance:** internación domiciliaria pediátrica, visitas profesionales, guardias, relevos, seguimiento longitudinal, firmas y consola web de coordinación.

## Por qué se realizó

La solicitud original exigía buscar sistemas comparables en GitHub **antes** de cerrar la arquitectura, para adoptar buenas metodologías y evitar reinventar soluciones existentes. Las etapas iniciales avanzaron sobre CONSULTLAN (solo tokens visuales) y SICOM (referencia conceptual de flujos), pero **no se había registrado un benchmark externo verificable**. Este documento corrige esa omisión. Ningún componente o archivo fuente de los repositorios comparados fue importado a CONSULTLAN Visitas Médicas en esta auditoría.

La búsqueda es amplia y reproducible por familias de productos, pero **no puede abarcar literalmente todos los repositorios de GitHub**. Se usaron búsquedas de proyectos de homecare, hospital-at-home, nursing shifts, care plan, visit verification, community health worker, EHR/FHIR y offline-first. Se contrastaron directorios, README, código representativo, metadatos y licencias de candidatos; se descartaron demos sin backend o licencias inadecuadas como fuente directa.

## Comparativa trazable

| Proyecto GitHub | Evidencia técnica inspeccionada | Valor para Pediatrics domiciliario | Licencia / restricción | Decisión |
| --- | --- | --- | --- | --- |
| [Folk Care](https://github.com/neighborhood-lab/folk-care) | [verticals/scheduling-visits](https://github.com/neighborhood-lab/folk-care/tree/develop/verticals/scheduling-visits), [care-plans-tasks](https://github.com/neighborhood-lab/folk-care/tree/develop/verticals/care-plans-tasks), packages/mobile/src, packages/core/src/audit | Referencia **funcional más próxima**: agendas recurrentes y ad hoc, cobertura, cuidadores, planes y tareas, incidentes, auditoría, app y web separadas | El [LICENSE](https://github.com/neighborhood-lab/folk-care/blob/develop/LICENSE) y package.json dicen **AGPL-3.0**, aunque README afirma MIT: prevalece licencia real; **no copiar código** sin revisión jurídica | **P1, arquitectura conceptual** |
| [OpenSRP FHIR Core](https://github.com/opensrp/fhircore) | [README](https://github.com/opensrp/fhircore/blob/main/README.md), app Android / docs | Operación sanitaria de campo offline, equipo, pacientes, formularios dinámicos SDC, recursos FHIR, cifrado | Apache-2.0; Kotlin/Android + Keycloak/HAPI-FHIR (no es drop-in para Expo/iOS) | **P1, patrones de flujo y offline** |
| [Avni Client](https://github.com/avniproject/avni-client) | [packages/openchs-android/src](https://github.com/avniproject/avni-client/tree/master/packages/openchs-android/src), repositories Realm/SQLite, task/Sync, Readme | App React Native de trabajadores de campo, repositorios locales y sincronización | AGPL-3.0; Android orientado a campo y servidor Avni; no copiar código en producto propietario sin cumplir licencia | **P1, arquitectura móvil conceptual** |
| [Community Health Toolkit](https://github.com/medic/cht-core) | api/, webapp/, shared-libs/, [arquitectura pública](https://docs.communityhealthtoolkit.org/technical-overview/architecture/) | Trabajos offline-first, tareas, visitas domiciliarias, reglas de seguimiento y sincronización | AGPL-3.0; CouchDB/PouchDB y complejidad operacional distinta | **P1, patrones de sincronización** |
| [Medplum](https://github.com/medplum/medplum) | packages/server, packages/react-scheduling, packages/fhirtypes, [README](https://github.com/medplum/medplum/blob/main/README.md) | FHIR, modelo clínico versionado, tareas, autorizaciones, agenda web, librerías TypeScript | Apache-2.0; plataforma completa implica adoptar infraestructura distinta a Supabase | **P1, semántica y componentes puntuales evaluables** |
| [OpenMRS](https://github.com/openmrs/openmrs-core) + [Patient Chart](https://github.com/openmrs/openmrs-esm-patient-chart) | api/, webapp/, módulos de formularios, notas, tareas, órdenes y signos; [arquitectura](https://devmanual.openmrs.org/technology/architecture/) | Separar atención clínica, notas, profesionales y formularios; modularidad y trazabilidad | Core: [MPL-2.0](https://github.com/openmrs/openmrs-core/blob/master/LICENSE), obligaciones por archivos; stack Java complejo | **P2, diseño de dominio clínico** |
| [UHIS Life-First Mobile](https://github.com/Medtronic-LABS/uhis_lf_mobile) | lib/core, lib/features/visit, lib/features/worklist, lib/features/sync | Flujo móvil por pasos, worklist, visita, borradores y sincronización; código reciente | MIT, pero Flutter/Dart; los algoritmos de triage/medicación no se transfieren sin validación clínica | **P1, UX y flujo de visita** |
| [CommandCare / Homecare Scheduling Platform](https://github.com/techrivers/Homecare-Scheduling-Platform) | src/pages/admin, caregiver, family, src/components/admin/scheduler, [useSchedulerData.ts](https://github.com/techrivers/Homecare-Scheduling-Platform/blob/main/src/hooks/useSchedulerData.ts) | Excelente **referente para un mockup** de consola de coordinación, tablero semanal por cuidador, cola de tareas no asignadas y vistas por rol | README afirma MIT, pero **no se encontró archivo LICENSE** en raíz: permiso de reutilizar código no acreditado. El hook usa arreglos mock en memoria; **NO es backend clínico** | **P1, inspiración visual, NO arquitectura de seguridad** |
| [CareShift — Clinical Scheduler](https://github.com/yitmeng00/clinical-scheduler-platform) | [Application/Swaps y Shifts](https://github.com/yitmeng00/clinical-scheduler-platform/tree/main/app/ClinicalScheduler.API/ClinicalScheduler.Application), web/src/features/schedule, swaps, overtime, audit | Backend .NET/PostgreSQL + React: turnos, cambios de guardia con aprobación, ausencias, sobrecarga y auditoría | [MIT verificada](https://github.com/yitmeng00/clinical-scheduler-platform/blob/main/LICENSE); proyecto pequeño sin auditoría clínica independiente; stack distinto de Supabase | **P1, workflows de relevos y aprobación** |
| [OpenEMR](https://github.com/openemr/openemr) | Repo principal, módulos EHR y práctica médica | Referente histórico para conciliación y documentación | GPL-3.0; gran sistema clínico ambulatorio, mayor costo de adopción | **P3, referencia secundaria** |
| [OpenCare](https://github.com/NexaFlowFrance/OpenCare) | README y licencia del proyecto de círculos familiares | Interacción con tutores y cuidadores autorizados, portal familiar a futuro | AGPL-3.0; focalizado en cuidado de adultos mayores | **P3, futuro portal familiar** |
| [CareFlow](https://github.com/xinyiklin/careflow) | README de React/Django/PostgreSQL y demos sintéticas | Visualización web de la historia y agenda | No hay licencia reutilizable verificada; propio README aclara que no es producto médico certificado | **P3, UI experimental solamente** |
| [HomeCare medication tracker](https://github.com/craigk5n/homecare) | README y flujos de exportación FHIR/PDF, calendario de medicación | Solo ideas generales de conciliación documental | GPL-2.0; además la institución conserva Kardex físico, por lo que no es base del producto | **No priorizar** |
| [Ottehr](https://github.com/masslight/ottehr) | README y [LICENSE](https://github.com/masslight/ottehr/blob/main/LICENSE), sin analizar su código interno | Plataforma EHR general, no elegida | Licencia **personalizada** con restricciones expresas sobre uso de código/lógica como referencia en sistemas IA, producto competidor y atribuciones. No tratarlo como MIT/OSI; **excluirlo como fuente de implementación y de prompts** | **EXCLUIDO** |

**Advertencia de evidencia:** popularidad, descripción de README o un badge de GitHub no equivalen a validación médica, cobertura de seguridad ni cumplimiento de normativa argentina. Folk Care declara estar listo para producción, pero esa es una afirmación del proyecto, no una certificación realizada aquí. CommandCare demuestra UX con datos mock y carece de backend clínico comprobado en este repositorio.

## Hallazgos de arquitectura aprovechables sin copiar código

### 1. Folk Care: separación por capacidades y ciclo de cobertura

Los directorios reales contienen verticales de programación, cuidadores, planes de cuidado, incidentes, visitas y auditoría; los servicios de scheduling tienen funciones dedicadas a asignación, no-shows, disponibilidad, reemplazos y alertas. El patrón útil es **módulos por capacidad** sobre un dominio común; no importar sus estados regulatorios de EVV estadounidense ni asumir que sus verificaciones GPS son necesarias en Argentina.

En Pediatrics, una **VISIT** de duración puntual y una **SHIFT** prolongada pertenecen al mismo episodio y deben diferenciar asignación, inicio, entrega de turno, cierre, ausencia, cancelación y excepción. El servidor decide transiciones y guarda auditoría; el cliente no certifica una atención por modificar un estado.

### 2. OpenSRP / Avni / CHT: experiencia sanitaria de campo

Los tres demuestran separación entre lista de trabajo, encuentro/visita, formularios dinámicos y caché/sincronización. Avni, en particular, tiene carpetas concretas para repositorios, servicio y tarea Sync dentro de una app React Native. OpenSRP FHIR Core usa Kotlin y FHIR; sirve para identificar requisitos pero no para reemplazar Expo sin una decisión de plataforma. CHT usa una pila CouchDB distinta, lo que desaconseja trasplantar infraestructura completa.

**Decisión:** etapa offline posterior, con almacenamiento cifrado, permisos de dispositivo, cola idempotente, detección de conflictos, expiración/revocación y borrado remoto. No se deben almacenar órdenes o firmas válidas en un dispositivo perdido; ningún cierre offline se considera clínicamente validado por sí solo.

### 3. Medplum / OpenMRS: dominio clínico, no base de datos ajena

Medplum aporta interoperabilidad FHIR (Patient, EpisodeOfCare, Encounter, CarePlan, Task, Observation, DocumentReference, Provenance/AuditEvent) y bibliotecas de React para scheduling. OpenMRS separa servicio clínico, API y módulos de formulario. Se recomienda mapear selectivamente los conceptos FHIR a nuestro esquema, **sin migrar la base Supabase** a otra plataforma ni proclamar una implementación FHIR completa.

El plan aprobado por Dirección Médica, la orden médica vigente, el episodio, la cobertura asignada, el evento clínico, el documento firmado y el evento de auditoría son objetos distintos. La APP no puede inventar dosis, tratamientos, consentimiento ni firma certificada. El material físico indicado por Pediatrics (Kardex, signos vitales, control de procedimientos, hoja de crisis) permanece físicamente en domicilio según la instrucción institucional.

### 4. CommandCare y UHIS: diseño de interfaz según tarea

CommandCare tiene componentes reales de calendario semanal, columnas por día/cuidador, barra de visitas sin asignar, carga de trabajo y portales segmentados; su estado en el hook es local y simulado. Es material para **diseñar interfaces**, no para copiar persistencia o seguridad. UHIS documenta una visita dividida en pasos, worklists y sincronización; su lógica clínica específica está contextualizada a otros programas y no debe trasplantarse al ámbito pediátrico domiciliario.

### 5. CareShift: reemplazos y aprobación humana

El repositorio [CareShift](https://github.com/yitmeng00/clinical-scheduler-platform) contiene frontend por funcionalidades (schedule, swaps, leaves, audit) y backend real de casos de uso (Shifts, Swaps, Leaves), a diferencia de los arreglos mock de CommandCare. Su licencia es MIT, y usa ASP.NET Core y PostgreSQL. Constituye una referencia para **proponer y aprobar intercambios de turno en dos pasos**, registrar ausencias y auditar quién autorizó. No se propone introducir .NET ni copiar a ciegas permisos. No presenta una auditoría clínica institucional independiente ni cubre las particularidades del episodio pediátrico domiciliario.

## Gap audit contra CONSULTLAN Visitas Médicas

| Capacidad | Estado real del repositorio propio (2026-10-11) | Evaluación |
| --- | --- | --- |
| Monorepo Expo móvil y backend Supabase independiente | Implementados y probados con datos sintéticos; backend nube sin desplegar | **CONSERVAR** |
| Episodio longitudinal, equipo, plan DRAFT, VISIT/SHIFT y relevos | Modelados, con RLS, Edge y pruebas; autorizaciones clínicas aún bloqueadas | **CONSERVAR / validar con Dirección Médica** |
| Agenda propia, horarios seguros y paginación 100+cursor | Probado en GitHub; sin conexión real a Supabase ni producto clínico | **CONSERVAR** |
| Consola web de coordinación | No existe apps/web; la app contiene demostraciones administrativas | **GAP NECESARIO: WEB-COORD-01** |
| Políticas de disponibilidad, reemplazos, múltiples pacientes y continuidad de cobertura | Parciales en planificación; falta modelar contingencias y confirmaciones humanas | **GAP NECESARIO** |
| Documentación clínica aprobada, órdenes y firma legal | No implementada; planillas solo en preview y soporte físico continúa | **GAP BLOQUEANTE de producción** |
| Offline cifrado + sincronización idempotente | No implementado | **GAP NECESARIO en campo, gate posterior** |
| Operador/administración vs. rol clínico | RLS sintética y permisos básicos; falta validación de flujos y vistas finales | **GAP BLOQUEANTE** |
| Facturación y conciliación por profesional / cobertura / período | Requisito identificado, no producto usable | **POSTERIOR a agenda y documentación validada** |
| Supabase remoto autorizado con actores sintéticos | STAGING-01F-REMOTE no realizado | **NO-GO** |
| Identidad visual | Paleta auditada de CONSULTLAN y diseño móvil preliminar | **CONSERVAR** |

## Decisión técnica propuesta

**No rehacer el sistema ni clonar un EHR grande.** Conservar el esquema caso/episodio primero, Supabase independiente, Expo y las pruebas GitHub-first. Adoptar la modularidad por capacidades de Folk Care, la disciplina offline/field de Avni/CHT/OpenSRP, los límites clínicos e interoperabilidad incremental de Medplum/OpenMRS y el tablero visual de CommandCare; sin importar código ni datos ajenos.

La web de coordinación será **un segundo cliente del mismo backend propio**, en lugar de un nuevo backend o una vista del servidor CONSULTLAN ambulatorio. Mantener una única fuente de roles, políticas, horarios y auditoría. Es una decisión de arquitectura que requiere las validaciones institucionales pertinentes, no una declaración de disponibilidad clínica.

## Lista de comprobación legal/técnica previa a cualquier reutilización

1. Verificar el archivo LICENSE, titulares, archivos de terceros y licencias transitivas **del commit exacto**; no basarse en una afirmación del README.
2. Para AGPL/GPL, revisar reciprocidad, distribución/uso de red y obligaciones con asesoría jurídica antes de integrar código en producto comercial.
3. Para MPL-2.0, verificar obligaciones a nivel de archivo modificado; para Apache-2.0/MIT, conservar avisos y comprobar patentes/atribuciones según corresponda.
4. Para proyectos sin licencia verificable o con restricciones de IA (Ottehr), **no copiar código** ni pedir a IA que reescriba esa fuente.
5. Registrar cualquier adopción autorizada mediante PR aparte con inventario de archivos, licencia, procedencia, cambios, pruebas y aprobación.
6. No usar datos reales de pacientes, llaves, firmas, screenshots clínicos, simuladores con PHI ni algoritmos de decisión médica de otros contextos.

## Proximidad con lo pedido y siguiente paso

- **Benchmark histórico pendiente:** queda aquí documentado y trazable. No pretendemos haber estudiado todos los repositorios del mundo.
- **ADR-004:** decisión de conservación del núcleo y desarrollo futuro del backoffice independiente.
- **WEB-COORD-01:** alcance de la futura consola, roles y propuestas visuales **antes** de escribir pantallas web definitivas.
- **Siguiente gate:** prototipos web de coordinación con fixtures 100% sintéticos y criterios de aceptación, en PR separado. Esto **no habilita producción** ni cambia las migraciones existentes.

**Fuentes:** URLs exactas de GitHub incluidas en las filas anteriores, verificadas durante el relevamiento del 2026-10-11. Las licencias pueden cambiar; revisar de nuevo al adoptar código.

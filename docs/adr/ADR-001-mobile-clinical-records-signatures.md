# ADR-001 — Modelo movil, formularios, firmas y diseno
Fecha: 2026-10-10. Estado: PROPOSED. Revisar con Pediatrics antes de implementar.

## Hallazgos verificados en formularios originales DOCX
Lectura programatica de texto y celdas de tablas (sin datos reales ni scans en GitHub):
- PLANILLA DE ASISTENCIA ENFERMERIA-CUIDADORAS: encabezado PACIENTE, OS, FECHA; tabla FECHA, HORARIO, FIRMA Y SELLO PROFESIONAL, FIRMA FAMILIAR. Contiene dos tablas/ejemplares.
- PLANILLA MEDICA: PACIENTE, OS, FECHA; FECHA, FIRMA PROFESIONAL, FIRMA PADRE, MADRE O TUTOR.
- PLANILLA KINES: PACIENTE, OS, FECHA; FECHA, FIRMA KINESIOLOGO, FIRMA FAMILIAR.
- PLANILLA DE FONO: PACIENTE, OS, FECHA; FECHA, FIRMA ESPECIALISTA, FIRMA FAMILIAR.
- PLANILLA DET.O: PACIENTE, OS, FECHA; FECHA, FIRMA ESPECIALISTA, FIRMA FAMILIAR.
- PLANILLA NUTRICION: PACIENTE, OS, FECHA; FECHA, FIRMA Y SELLO, FIRMA DEL TUTOR.
- CONTROL PROCEDIMIENTOS: PACIENTE, OS; FECHA, HORARIO, PROCEDIMIENTO, FIRMA PROFESIONAL; menciona canula E.T., boton, SNG, otros.
- HOJA DE CRISIS: FECHA, TIPO DE CRISIS, DURACION.
- HOJA DE EVOLUCION: PACIENTE, FECHA, OS; area de evolucion sin campo estructurado en texto.
- KARDEX.ID y SIGNOS VITALES: contenido principal embebido graficamente, no puede darse por inventariado a partir de texto DOCX. Requiere inspeccion visual.
- CARDOZO SEPTIEMBRE.pdf: documento escaneado real; no debe publicarse ni incorporarse a fixtures, requiere evaluacion visual en entorno privado.
Conclusiones: NO inferir valores clinicos concretos ni obligatoriedad de todos los campos basados solo en nombres de documentos. Muchos impresos acreditan asistencia, no describen necesariamente acto clinico completo.

## Recomendacion de producto
Una prestacion tiene dos expedientes relacionados pero no equivalentes:
A) Registro clinico (evolucion/procedimiento/observacion); firmado por profesional segun norma aplicable.
B) Evidencia de asistencia/conformidad (fecha, rango horario, profesional, especialidad, conformidad o rechazo de familiar/tutor); no sustituye consentimiento informado ni firma profesional.
Modelar ambos bajo Visit ID, con documentos y ciclos de vida independientes.

## Flujo / maquina de estados
Visita: PLANNED -> ASSIGNED -> IN_PROGRESS -> PENDING_REVIEW -> PENDING_SIGNATURE -> CLOSED_VERIFIED.
Alternativas: CANCELLED, NOT_PERFORMED, SIGNATURE_REFUSED, SIGNER_UNAVAILABLE, SYNC_PENDING, REOPEN_REQUESTED (solo addendum; no edicion del documento cerrado).
Un dispositivo offline puede guardar borrador, pero nunca asignar CLOSED_VERIFIED ni timestamp/validacion central.
Firma familiar: REQUESTED -> PRESENTED -> ACCEPTED | REFUSED | UNAVAILABLE | EXPIRED. Debe verse claramente a que evidencia esta vinculada, con identificacion de quien firma y calidad invocada (padre, madre, tutor, cuidador autorizado). Ser cuidador no implica automatico ser representante legal.

## Seguridad obligatoria
- Matriz RBAC + ABAC (profesional solo visita asignada, equipo coordinador segun jurisdiccion, auditor lectura controlada); bloqueo de acceso entre pacientes.
- Idempotency-Key y control de version If-Match al sincronizar; evitar visitas duplicadas, doble firma y cierres reintentados.
- Consentimiento y conformidad separados; firmas no reutilizables.
- Aplicacion solo con datos necesarios; cifrado en dispositivo; purgado remoto al revocar sesion al recuperar conexion; expiracion de informacion cacheada.
- Informacion sanitaria no entra a GitHub, CI logs, analytics comerciales ni proveedores no autorizados.
- Fecha/horario del servidor y prueba de la version del documento; hash no implica por si mismo autenticidad de firmante.
- Integracion firma digital certificada por prestador autorizado cuando corresponda; e-sign captura en pantalla para familiar bajo validacion juridica particular.

## ADN visual REAL de CONSULTLAN
Origen verificado: tulatraes25/consultlan@ae53227304844904c47f979544e9b110d5d902ce, src/frontend/web-next/src/shared/styles/tokens.css
--color-canvas #F4F6F8; --color-surface #FFFFFF; --color-primary #166534; --color-primary-subtle #F0FDF4; --color-brand-deep #0B3D2A; --color-brand-mint #DDF5E6; --color-text-primary #1F2937; --color-text-secondary #4B5563; --color-success #0E9F86; --color-danger #D64545; --color-info #0E7CC2.
Fuente de referencia: system font stack; espaciado 2/4/6/8/12/16/20/24/32 px. Altura tactil MINIMA 44 px; adaptar tipografia legible movil.
IMPORTANTE: prototipo anterior con acciones primarias azules no representa el producto final.

## Arquitectura candidata
React Native + Expo + TypeScript para movil; backend REST protegido separado, con PostgreSQL y artefactos firmados versionados. La decision final requiere verificar posibilidades de compartir contratos con backend actual Java/Spring y estrategia de login; no montar backend nuevo sin contrato de integracion y seguridad aprobado.

## Criterios de aceptacion de Gate 0
1. Inventario de campos de imagen Kardex/Signos y PDF por revision visual privada sin divulgacion de PHI.
2. Confirmacion con equipo Pediatrics de que hojas domiciliarias no se sustituyen, de que se documenta en sistema y de requerimientos de obras sociales.
3. Descripcion formal de rol/accion/contexto y firmas de responsable y profesional.
4. Primer contrato API documentado (sin datos reales) y pruebas negativas de permisos.
5. Decision registrada de firma digital y custodia documental.
6. UI utiliza tokens reales verdes de CONSULTLAN, probada en telefono/tablet.

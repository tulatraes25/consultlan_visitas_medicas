# HC-03C — Constancia por prestación, consentimiento y evidencia de firma (SPEC / diseño, sin activación clínica)

**Estado:** especificación para revisión clínica, administrativa, legal y de seguridad. **No autoriza implementación de firmas ni uso con pacientes.**
**Dependencias:** HC-01, HC-02A/B, HC-02C pendiente, HC-03A/B, ADR-003.

## 1. Objetivo y alcance
Definir un expediente verificable por prestación de internación domiciliaria pediátrica, ligado al episodio y a una visita puntual o tramo concreto de guardia. La constancia no reemplaza la historia clínica, indicación médica, evolución profesional, Kardex ni planilla física hasta aprobación institucional y legal documentada.

Distinguir rigurosamente: (a) identidad y autenticación del profesional, (b) identidad y capacidad/representación del familiar o tutor, (c) aceptación o rechazo explícito de una declaración concreta, (d) evidencia de una acción electrónica, y (e) **firma digital** en sentido jurídico, que exige solución y requisitos específicos no aportados automáticamente por Supabase ni por un trazo sobre pantalla.

## 2. Invariantes de seguridad
- Un caso pediátrico pertenece solo a este Supabase autónomo. No se enlaza ni sincroniza con usuarios, pacientes, agenda o servidores de CONSULTLAN/Pediatrics ambulatorio.
- Antes de habilitar captura real: aprobación de Dirección Médica, responsable de tratamiento de datos, asesoría legal y área administrativa; análisis de normativa argentina vigente y jurisdicción aplicable; política de retención y ejercicio de derechos; análisis de amenazas y DPIA/evaluación de impacto de privacidad cuando corresponda.
- No aceptar datos identificables o clínicos reales en repositorio público, fixtures, logs, analytics, correos ni notificaciones push. Prohibir JWT/service_role en cliente; todos los comandos sensibles pasan por backend autorizado y auditado.
- Bloquear firmar/emitir si episodio no está activo y aprobado por circuito HC-02C; asignación no válida; profesional sin permiso vigente; prestación sin constancia temporal; identidad del compareciente no comprobada; discrepancia relevante, rechazo, o desconexión sin prueba íntegra.
- La firma manuscrita dibujada jamás debe presentarse como firma digital certificada. Sin proveedor/mecanismo jurídico validado, la UI solamente puede demostrar el flujo con datos sintéticos y rótulo visible "DEMO — sin validez".
- Nunca inferir consentimiento sanitario global del asentimiento a una constancia de presencia. Atención clínica, tratamiento de datos y constatación de visita son propósitos diferentes.

## 3. Requisitos funcionales
**R1. Unidad documental:** una constancia por identificador inmutable de prestación/segmento realmente realizado; incluye IDs internos de episodio, asignación, profesional actuante, modalidad VISIT/SHIFT, intervalo programado/efectivo y zona horaria, versión de formulario y declaración mostrada. Guardias con relevo generan segmentos diferenciados; no se permite firmar horas ajenas.

**R2. Declaraciones específicas:** registrar qué afirma cada parte (por ejemplo constancia de presencia/recepción), texto exacto, versión, idioma y hash. Nunca atribuir a familiar/tutor conformidad clínica general ni aprobación de procedimientos implícita.

**R3. Compareciente:** tipo de vínculo declarado, verificación documentada de identidad y capacidad/representación legal según protocolo aprobado. Contemplar ausencia, negativa, tutor no disponible, cambio de cuidador, idioma, discapacidad/accesibilidad y conflictos de representación; no forzar firma.

**R4. Profesional:** identidad validada y matrícula/habilitación cuando corresponda, especialidad, rol, asignación y sesión autenticada con autorización vigente; impedir suplantación y firmas por cuenta de otro.

**R5. Estados:** DRAFT -> READY_FOR_REVIEW -> PENDING_ATTESTATIONS -> ISSUED. Rutas independientes REJECTED, DISPUTED, CANCELLED y VOIDED_BY_CORRECTION. Ningún estado terminal se modifica destructivamente; se relaciona nueva versión rectificativa con motivo y auditoría. No afirmar emisión hasta confirmar persistencia segura.

**R6. Evidencia:** hash criptográfico de representación canónica/versionada del documento y anexos, sello temporal del servidor con fuente de confianza definida, identidad autenticada, dispositivo/sesión minimizados, identificador de operación idempotente y evento auditado append-only. Evaluar sellado o firma de servidor/proveedor confiable; un hash por sí solo no prueba identidad ni firma válida. Almacenar información técnica mínima proporcional.

**R7. Generación:** documento de lectura con identificador verificable y referencia a versión previa si rectifica. PDFs y enlaces verificables solo después de aprobar mecanismo de almacenamiento, retención y acceso. Nada de enlaces públicos permanentes; acceso limitado y revocable, trazable por rol.

**R8. Operación móvil:** pantalla responsive teléfono/tablet, accesible, permite revisar texto completo antes de cualquier manifestación. La conectividad intermitente no equivale a aceptación: offline solo permite borrador local protegido si se aprueba posteriormente, nunca la emisión/sello retroactivo.

**R9. Conflictos:** idempotencia por actor, episodio, segmento, declaración/version y clave de comando; invalidar concurrencias, dobles envíos y asignaciones revocadas; registrar causas y no perder evidencia de rechazos.

**R10. Datos:** mínimo necesario, cifrado en tránsito y reposo, control RLS + funciones servidor para escrituras privilegiadas, auditoría segregada, retención definida, exportación autorizada, respaldo y restauración ensayada, respuesta a incidentes y baja por expediente conforme obligación aplicable.

## 4. Modelo lógico provisional (NO migrar aún)
- attestation_documents(id, episode_id, coverage_segment_id, form_version, statement_hash, canonical_payload_hash, status, supersedes_id, created_at, issued_at)
- attestation_parties(id, document_id, party_role, identity_verification_reference, representation_basis, verification_status)
- attestation_events(id, document_id, actor_id, event_type, statement_version, recorded_at, idempotency_key, evidence_digest, audit_correlation_id)
- attestation_artifacts(id, document_id, storage_key_private, checksum, renderer_version, retention_class)

Se deben separar claramente metadatos no clínicos de contenido sensible, no exponer identificadores legibles en URLs públicas y mantener cardinalidad/integridad con episodios, prestaciones, profesionales y eventos de relevo. El modelo es propuesta, no contrato aprobado.

## 5. Amenazas y pruebas mínimas exigidas
1. Intentos entre dos familias/casos y dos profesionales sin relación: denegados en SQL/RLS y gateway.
2. Profesional desasignado, episodio pausado, plan no aprobado, guardia aún no realizada o con horas de otro profesional: denegados.
3. Firmante que rechaza, no puede acreditar representación o es menor sin capacidad aplicable verificada: constancia no emitida como aceptada.
4. Repetición de solicitud, carreras concurrentes, cambio de versión de texto o payload después de presentación: sin doble emisión y con hash diferente; rechazo de modificación.
5. Reloj del teléfono adulterado, modo avión, timeout de carga y token vencido: no se simula consentimiento ni se retrodata firma.
6. Pérdida de móvil, lectura de cachés, URL filtrada, capturas en logs, backups/restore y borrado bajo políticas: pruebas documentadas y brechas cerradas.
7. Verificación externa del documento: detectar alteraciones; comprobar el alcance real de la evidencia sin atribuirle fuerza jurídica no validada.
8. Accesibilidad táctil, lector de pantalla, conexiones lentas, tablet y móvil, y separación entre declaración de presencia y consentimiento médico.

## 6. Decisiones pendientes (bloqueantes)
- **CLIN-01** Dirección Médica: propósito legal y clínico exacto de cada constancia; quién firma y cuándo; procedimiento ante ausencia o rechazo; guardias, relevos y correcciones.
- **LEGAL-01** Asesoría legal: validez y modalidad de firma electrónica vs. firma digital, Ley 25.506 y marco de historia clínica/protección de datos aplicable; identidad de responsables; conservación, exhibición, pruebas y representación del menor.
- **SEC-01** Responsable de seguridad: arquitectura de gestión de identidad, autenticación reforzada, auditoría, cifrado, dispositivo extraviado, respaldo y proveedor de sello/firma.
- **OPS-01** Área administrativa: recepción y verificación, facturación/obra social solo si se aprueba alcance, excepciones e impugnaciones.
- **SRC-01** Pediatrics: cotejar contra los originales el alcance de 7 formularios y expediente mensual; el PDF escaneado de 56 páginas sigue pendiente de validación exhaustiva.

## 7. Criterios de aceptación y secuencia de gates
**Gate HC-03C-SPEC (este documento):** definiciones, rutas de error, amenazas, pruebas y bloqueos claros; cero captura, cero firma, cero migración y cero promesa de validez legal.

**Gate HC-02C:** aprobación clínica real de plan/activación de episodio y autorización por acto; prohibir bypass manual.

**Gate HC-03D-DESIGN (posterior a aprobaciones):** contrato de eventos y validación jurídica firmada; elección justificada del proveedor/mecanismo, diagrama de amenazas y matriz de acceso/retención.

**Gate HC-03E-IMPLEMENT:** implementación GitHub-first con datos sintéticos, RLS/gateway, auditoría, pruebas negativas y CI verde en commit exacto; QA profesional, seguridad y legal antes de activar cualquier paciente real.

**Regla de avance:** ni un mock de firma ni una prueba verde convierten el producto en apto para atención clínica. Ningún gate posterior se declara certificado sin PR, CI sobre cabeza exacta y CI posterior al merge.

## 8. Riesgos a vigilar
Crítico: validez de representación del menor, identidad, firmas, privacidad de datos de salud, intentos entre episodios y falsa equivalencia entre presencia y conformidad clínica. Alto: conectividad domiciliaria, relevo entre turnos y reconstrucción de evidencias. Medio: accesibilidad, costo y dependencia de proveedor.

**Siguiente acción:** revisión multidisciplinaria de CLIN-01, LEGAL-01, SEC-01, OPS-01 y SRC-01 antes de editar esquema o habilitar capturas reales.

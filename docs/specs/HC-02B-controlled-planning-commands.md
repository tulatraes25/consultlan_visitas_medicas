# HC-02B — Operaciones administrativas y de cobertura domiciliaria

**Estado:** candidato GitHub-first, pendiente de PR/CI/post-merge (2026-10-10).
**Autoridad:** ADR-002 (Supabase propio) y ADR-003 (episodio de internación domiciliaria), FORM-001 (planillas originales de Pediatrics).
**Datos:** solo identidades/episodios sintéticos; sin proyecto Supabase activo.

## Objetivo

Convertir el modelo de HC-01 y HC-02A en operaciones transaccionales auditables, **sin habilitar por accidente decisiones médicas**. La población es diferente de los consultorios de Pediatrics; la app no importa ni sincroniza pacientes ni profesionales de CONSULTLAN.

### Qué queda implementado en este gate

| Acción del cliente (Edge) | Función PostgreSQL | Alcance autorizado |
|---|---|---|
| `createHomecareEpisodeDraft` | `api_hc_create_episode_draft` | ADMIN / COORDINATOR: episodio DRAFT de paciente propio activo |
| `assignHomecareCareTeamMember` | `api_hc_assign_team_member` | ADMIN / COORDINATOR: miembro CARE_TEAM, no certifica dirección médica |
| `createHomecarePlanDraft` | `api_hc_create_plan_draft` | ADMIN / COORDINATOR: **solo metadatos** del borrador de plan, sin tratamiento ni indicaciones |
| `scheduleHomecareCoverage` | `api_hc_schedule_coverage` | ADMIN / COORDINATOR: VISIT o SHIFT, caso ACTIVE, plan previamente APPROVED, profesional activo del equipo |
| `requestHomecareHandover` | `api_hc_request_handover` | ADMIN / COORDINATOR: solicitud PENDING entre guardias SHIFT consecutivas del mismo episodio |
| `acknowledgeHomecareHandover` | `api_hc_ack_handover` | Profesional entrante identificado, activo, asignado al equipo: únicamente constancia de **recepción** |

La agenda es un **roster único**: tanto visitas como turnos de cuidados prolongados se comprueban contra el mismo calendario del profesional. Para VISIT, la operación crea atómicamente la cobertura y su fila de visita; SHIFT no crea una falsa visita puntual. Los comprobantes y los formatos de firma de las planillas originales se incorporarán después, sin reemplazar Kardex, signos vitales, procedimientos ni hoja de crisis que quedan en el domicilio.

## Seguridad e invariantes

- Solo la Edge Function verifica Supabase Auth. Obtiene `p_actor` del usuario verificado por el **servidor**, no del JSON del celular.
- Las seis RPC son `SECURITY DEFINER` con `search_path = ''`, SQL con nombres cualificados, sin SQL dinámico. `EXECUTE` exclusivo de `service_role`; `anon` y `authenticated` no pueden llamarlas.
- Las tablas de episodios, equipo, planes, coberturas y relevos **no reciben permisos directos de escritura** para `service_role` ni teléfonos. Los cambios se hacen mediante funciones acotadas y auditadas.
- El actor debe tener membresía activa en la organización adecuada, rol correcto y, cuando corresponde, asignación real al equipo del episodio. Las claves `request_key` UUID y el bloqueo de transacciones previenen registros duplicados ante reintentos.
- La cobertura requiere episodio ACTIVE, plan APPROVED preexistente, profesional activo del equipo y vigencia que cubra **tanto el inicio como el fin** del turno. Hay restricción PostgreSQL GiST de solapamiento de VISIT/SHIFT; cobertura no puede durar más de 24 horas en una sola asignación del gate (sujeto a confirmación operativa).
- Una solicitud de relevo une **SHIFT → SHIFT consecutivos**, mismo episodio y organización. ACKNOWLEDGED acredita exclusivamente que la identidad del profesional receptor ejecutó la acción; **no prueba que se comunicara contenido clínico, que se firmara digitalmente o que una emergencia fuera atendida**.
- La bitácora incluye IDs, categoría, versión y actor, jamás narrativas clínicas, firma manuscrita, Kardex o diagnósticos.
- No hay credenciales ni archivos originales de Pediatrics en GitHub. En CI se usan sujetos y pacientes inventados.

## Lo que NO se habilita todavía

**La aprobación clínica es un requisito bloqueante separado.** Ninguna de las seis operaciones:
- acredita matrícula, especialidad habilitante, consentimiento o función de director médico;
- convierte DRAFT → ACTIVE, DRAFT → APPROVED, ni concede egreso clínico;
- crea órdenes médicas, dosificación, protocolos de crisis o alertas vitales;
- permite el uso de firmas táctiles como firmas digitales certificadas;
- almacena o modifica evolución clínica desde la agenda de guardias.

Por lo tanto, **un episodio nuevo creado por estas funciones permanece DRAFT, su plan es DRAFT y no puede programarse como cuidado activo hasta incorporar el gate de autorización clínica**. Las pruebas de programación utilizan exclusivamente **fixtures sintéticos APPROVED/ACTIVE** del SQL anterior; no representan autorización médica real. Esta limitación evita una falsa sensación de producto terminado.

La Edge anterior mantiene rutas históricas de SUPA-02, que permanecen bloqueadas por los nuevos controles de integridad. La compatibilidad y retirada de rutas de prototipo serán un gate de limpieza posterior.

## Plan de verificación (GitHub)

1. Mantener tests preexistentes SUPA-01/02, HC-01 y HC-02A sobre PostgreSQL 16 aislado.
2. Aplicar la migración `20261010040000_homecare_controlled_commands.sql`, luego `homecare_controlled_commands.sql`.
3. Probar suplantación por JWT/mobile, permiso de ADMIN/COORDINATOR vs profesional, paciente ajeno, aislamiento de organización, idempotencia, versión de borrador, atomicidad VISIT+roster, turno solapado, plan expirado, relevo incorrecto, acuse de receptor, revocación de membresía y bitácora sin duplicados.
4. Pruebas Deno Edge: seis rutas permitidas, rechazo de campos de rol/actor falsos, `service_role` filtrado, forma de versión de plan, tokens revocados y prohibición expresa de acciones clínicas no implementadas.
5. TypeScript/React Native/bundles de Android e iOS preexistentes permanecen verdes; verificar diff, PR completo, merge normal y post-main CI exacto.

## Próximo gate HC-02C (alto riesgo médico)

Incorporar el **registro verificado de profesionales responsables y su habilitación**, circuito de aprobación humana y evidencia de consentimiento/competencia para activar un episodio y autorizar versiones de plan. Requiere aprobación de Dirección Médica y del responsable de datos, pruebas de revocación, y definición de autoridades de firmas; **no se improvisarán autorizaciones mediante un simple campo booleano editable**.

Una vez cerrado el circuito clínico, conectar la gestión administrativa móvil a Supabase staging propio y desarrollar las hojas de asistencia/evolución alineadas con FORM-001, sin sustituir el papel del domicilio.

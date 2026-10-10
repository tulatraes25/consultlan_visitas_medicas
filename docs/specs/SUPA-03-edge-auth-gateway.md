# SUPA-03 — Edge Functions de autenticación y operaciones

**Estado:** código en GitHub y pruebas Deno sintéticas, **sin proyecto Supabase conectado**.

## Objetivo
Cerrar el límite de confianza entre aplicación React Native y las RPC `service_role` de SUPA-02. El usuario solo puede enviar un JWT de Supabase Auth propio y los campos explícitos de una operación; nunca aporta `p_actor`, roles, nombre de función SQL ni claves privilegiadas.

## Contrato móvil (futuro, no implementado en la demo)
`POST /functions/v1/visits` con `Content-Type: application/json`, `Authorization: Bearer <JWT de usuario>` y `apikey` publicable de **este** proyecto Supabase. JSON:

- `action = createPatient`: organizationId, displayName, requestKey (UUID)
- `registerProfessional`: organizationId, authUserId de usuario ya invitado en ESTE Auth, specialty
- **SUPA-04:** las operaciones de visita histórica `scheduleVisit`, `beginVisit`, `addClinicalNote`, `submitVisitReview` y `cancelVisit` están bloqueadas (422) en la Edge. No constituyen un contrato clínico vigente.

### HC-02B — Comandos de internación domiciliaria

El mismo gateway añade seis operaciones con validación estricta de campos:

- `createHomecareEpisodeDraft`: organizationId, patientId (paciente del programa), requestKey
- `assignHomecareCareTeamMember`: organizationId, episodeId, professionalId
- `createHomecarePlanDraft`: organizationId, episodeId, requestKey
- `requestHomecarePlanReview` (HC-02C1B): organizationId, episodeId, carePlanVersion, requestKey; solo solicitud PENDING, sin aprobación
- `scheduleHomecareCoverage`: organizationId, episodeId, professionalId, carePlanVersion (entero positivo), serviceKind = VISIT|SHIFT, scheduledStart, scheduledEnd, requestKey
- `requestHomecareHandover`: organizationId, outgoingCoverageId, incomingCoverageId
- `acknowledgeHomecareHandover`: organizationId, handoverId

La creación de episodios, planes y permisos no implica atención activa. **No existe** comando para aprobar indicaciones, verificar matrículas, activar internaciones, confirmar emergencias ni cerrar documentos clínicos firmados. `scheduleHomecareCoverage` será rechazado por PostgreSQL si el caso no está ACTIVE con plan APPROVED y profesional autorizado. Los casos y planes aprobados de CI son exclusivamente simulaciones.

**SUPA-04 — recorte del alcance clínico:** se retiraron las cinco rutas clínicas históricas del allowlist Edge. Sus RPC SQL históricas pueden seguir existiendo para pruebas del prototipo, pero ningún comando de Edge las invoca. No desplegar acceso directo a RPC privilegiadas; el backend mantiene exclusivos sus secretos. Las rutas de registro administrativo y los comandos HC-02B/HC-02C1B permanecen sujetos a SQL, permisos y auditoría.

No se acepta ningún otro campo. Fechas ISO 8601, UUIDs válidos, cuerpos hasta 32 KiB. Las respuestas son JSON con `Cache-Control: no-store`. Las credenciales nunca se registran en logs.

## Arquitectura
1. Gateway Supabase verifica un JWT de usuario (`verify_jwt=true`).
2. La Edge Function vuelve a consultar `/auth/v1/user` con ese JWT contra **su propio proyecto**, verificando identidad y rechazando cuentas anónimas, expiradas o inválidas.
3. **SEC-SESSION-01**: solo después de verificar la identidad, extrae `sub` y `session_id` del JWT, compara `sub` con el usuario verificado y consulta `api_is_live_session` mediante credencial exclusiva de Edge. La RPC exige una sesión todavía presente en `auth.sessions` del propio Supabase. Sesión ausente, ajena, sin ID, expirada o RPC no disponible: **no despachar**.
4. Solo una sesión validada aporta el usuario que se convierte en `p_actor`, sin usar ningún ID declarado en el JSON.
5. Se invoca una RPC de lista cerrada usando secreto **exclusivo del servidor**, nunca credenciales aportadas por el dispositivo.
6. La RPC de la operación vuelve a verificar membresía/organización/profesional y registra auditoría de mutación. Solo se concedió `EXECUTE` al rol backend.
7. Los errores 42501 / 23505 / 23P01 / 22023 se convierten en 403/409/409/422 sin revelar SQL ni notas clínicas.
8. Cualquier validación externa o fallo de servicio es **fail closed**.

## Seguridad y restricciones
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (o `SUPABASE_ANON_KEY`) y `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`) se proveen **en secretos de Edge**, nunca en GitHub ni en el bundle.
- La Edge usa el token real de usuario únicamente para verificar la sesión. Nunca expone su token ni los secretos `service_role` en respuestas.
- El rol `service_role` puede saltarse RLS; **la seguridad final depende tanto del gateway autenticado como de validaciones SQL**. El proyecto real requiere pruebas end-to-end con sesión válida, revocada y permisos cruzados.
- El chequeo de existencia de sesión se prueba por ahora con el `auth.sessions` sintético de PostgreSQL CI. Su compatibilidad exacta, baja tras `signOut`, latencia y disponibilidad deben comprobarse en Supabase staging antes de operar. Es una condición necesaria, no sustituye autorización médica.
- Con claves modernas `sb_secret_...` se usa `apikey` del servidor; con service-role JWT legado se incorpora además Authorization. Ambas variantes requieren pruebas reales en staging antes de uso clínico.
- No se implementa alta inicial/invitación de usuario, gestión de roles administrativos, carga de archivos ni cierre firmado. Corresponden a gates posteriores.
- No se utiliza CONSULTLAN como identidad, proveedor de API ni base de datos.

## Criterios de aceptación GitHub
- Deno `check` sobre Edge index y tests.
- Deno `test` con denegación por falta de JWT, JWT no verificado, payload malicioso, suplantación de actor/rol, operaciones desconocidas, carga excesiva, errores SQL, pérdida de servicio y flujos autorizados.
- Mantener CI PostgreSQL SUPA-01/SUPA-02 y app React Native.
- PR y post-merge CI verdes en SHA exacto. No significa app instalada ni Supabase configurado.

## Próximo Gate: HC-02C (autorización clínica)
MOB-ADMIN-01 ya se implementó como prototipo visual aislado. Antes de conectar la app, validar el circuito de habilitación de profesionales/planes y activación del episodio por responsables médicos; ninguna aprobación puede depender de un rol ADMIN ni de un campo editable desde el teléfono.

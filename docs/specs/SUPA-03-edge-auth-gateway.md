# SUPA-03 — Edge Functions de autenticación y operaciones

**Estado:** código en GitHub y pruebas Deno sintéticas, **sin proyecto Supabase conectado**.

## Objetivo
Cerrar el límite de confianza entre aplicación React Native y las RPC `service_role` de SUPA-02. El usuario solo puede enviar un JWT de Supabase Auth propio y los campos explícitos de una operación; nunca aporta `p_actor`, roles, nombre de función SQL ni claves privilegiadas.

## Contrato móvil (futuro, no implementado en la demo)
`POST /functions/v1/visits` con `Content-Type: application/json`, `Authorization: Bearer <JWT de usuario>` y `apikey` publicable de **este** proyecto Supabase. JSON:

- `action = createPatient`: organizationId, displayName, requestKey (UUID)
- `registerProfessional`: organizationId, authUserId de usuario ya invitado en ESTE Auth, specialty
- `scheduleVisit`: organizationId, patientId, professionalId, scheduledStart, scheduledEnd, requestKey
- `beginVisit`: organizationId, visitId
- `addClinicalNote`: organizationId, visitId, narrative, requestKey
- `submitVisitReview`: organizationId, visitId
- `cancelVisit`: organizationId, visitId, reasonCode (catálogo definido).

No se acepta ningún otro campo. Fechas ISO 8601, UUIDs válidos, cuerpos hasta 32 KiB. Las respuestas son JSON con `Cache-Control: no-store`. Las credenciales nunca se registran en logs.

## Arquitectura
1. Gateway Supabase verifica un JWT de usuario (`verify_jwt=true`).
2. La Edge Function vuelve a consultar `/auth/v1/user` con ese JWT contra **su propio proyecto**, verificando identidad actual. Rechaza cuentas anónimas y errores.
3. El ID confirmado por Auth se convierte en `p_actor`, sin usar ningún ID declarado en el JSON.
4. Se invoca una RPC de lista cerrada usando secreto **exclusivo del servidor**, nunca credenciales aportadas por el dispositivo.
5. La RPC vuelve a verificar membresía/organización/profesional y registra auditoría de mutación. Solo se concedió `EXECUTE` al rol backend.
6. Los errores 42501 / 23505 / 23P01 / 22023 se convierten en 403/409/409/422 sin revelar SQL ni notas clínicas.
7. Cualquier validación externa o fallo de servicio es **fail closed**.

## Seguridad y restricciones
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (o `SUPABASE_ANON_KEY`) y `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`) se proveen **en secretos de Edge**, nunca en GitHub ni en el bundle.
- La Edge usa el token real de usuario únicamente para verificar la sesión. Nunca expone su token ni los secretos `service_role` en respuestas.
- El rol `service_role` puede saltarse RLS; **la seguridad final depende tanto del gateway autenticado como de validaciones SQL**. El proyecto real requiere pruebas end-to-end con sesión válida, revocada y permisos cruzados.
- Con claves modernas `sb_secret_...` se usa `apikey` del servidor; con service-role JWT legado se incorpora además Authorization. Ambas variantes requieren pruebas reales en staging antes de uso clínico.
- No se implementa alta inicial/invitación de usuario, gestión de roles administrativos, carga de archivos ni cierre firmado. Corresponden a gates posteriores.
- No se utiliza CONSULTLAN como identidad, proveedor de API ni base de datos.

## Criterios de aceptación GitHub
- Deno `check` sobre Edge index y tests.
- Deno `test` con denegación por falta de JWT, JWT no verificado, payload malicioso, suplantación de actor/rol, operaciones desconocidas, carga excesiva, errores SQL, pérdida de servicio y flujos autorizados.
- Mantener CI PostgreSQL SUPA-01/SUPA-02 y app React Native.
- PR y post-merge CI verdes en SHA exacto. No significa app instalada ni Supabase configurado.

## Próximo Gate: MOB-ADMIN-01
Construir en el móvil el módulo administrativo con interfaz verde institucional, formularios para altas de pacientes/profesionales y agenda con fixtures ficticios; autenticación/llamadas reales bloqueadas hasta instancia staging certificada.

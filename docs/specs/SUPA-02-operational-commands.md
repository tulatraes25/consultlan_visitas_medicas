# SUPA-02 — Comandos operativos de visitas (SPEC/Kiro)

**Estado:** implementación en SQL y tests con PostgreSQL sintético; no hay Supabase desplegado ni app conectada.

## Propósito
Habilitar el núcleo transaccional que usará una Edge Function **autenticada y auditada**. No agregar permisos de escritura a React Native y no compartir infraestructura con CONSULTLAN.

## Requisitos y criterios de aceptación

| Requisito | Operación backend-only | Criterio |
|---|---|---|
| Alta de pacientes | `api_create_patient` | ADMIN/COORDINATOR de la organización activa; UUID de operación para idempotencia; nunca registra notas reales |
| Alta de profesional | `api_register_professional` | Solo ADMIN; Auth UID debe existir previamente en **este** Supabase; no cambia roles existentes |
| Agenda | `api_schedule_visit` | ADMIN/COORDINATOR; paciente/profesional activos en organización; sin superposición; reintentos no duplican |
| Inicio de prestación | `api_begin_visit` | Solo profesional activo asignado; estado ASSIGNED; hora del servidor |
| Evolución | `api_add_clinical_note` | Solo profesional propio en IN_PROGRESS; nueva versión + auditoría; reintentos idénticos no duplican |
| Envío a revisión | `api_submit_visit_review` | Solo profesional propio con nota existente; pasa a PENDING_REVIEW |
| Cancelación | `api_cancel_visit` | ADMIN/COORDINATOR; antes de comenzar y con motivo **codificado** |
| Seguridad | Todos | RPC ejecutables solo por `service_role`, no por `anon` ni `authenticated` |
| Auditoría | Todos | Evento estructurado con IDs y códigos, sin narrativas clínicas, claves ni firmas |
| Cierre | Ninguno | No se habilita `CLOSED_VERIFIED` sin firma profesional certificada y conformidad definida |

## Límite de confianza obligatorio

Los RPC definidos en `public` son `SECURITY INVOKER`; se concede `EXECUTE` **exclusivamente** a `service_role` y se revoca `PUBLIC`, `anon`, `authenticated`. La verificación `p_actor` en SQL aplica roles vigentes de membresía y pertenencia a visita/organización, pero NO prueba que el UUID provenga de un usuario autenticado. Por lo tanto:

1. Una futura Edge Function recibe token Bearer e invoca Supabase Auth para verificar **firma, validez y usuario actual**. No se aceptan claims de rol arbitrarios ni un `p_actor` enviado por el cliente.
2. Una vez verificado el token, la Edge Function crea el cliente `service_role` con secreto del entorno **solo en el servidor**, e invoca el RPC con `p_actor=verifiedUser.id`.
3. Valida tipos, limites, permisos y errores del RPC. Las funciones SQL vuelven a verificar membresía activa, especialidad/profesional, organización y estado.
4. Mantener la URL/clave `service_role` fuera del bundle, repositorio, logs y respuestas. Logs externos no deben incluir datos de salud.
5. `service_role` puede saltarse RLS; por eso **el perímetro de las Edge Functions forma parte del gate obligatorio siguiente** y requiere pruebas de spoofing, credenciales revocadas, organización cruzada, cambios de rol, cuota y abuso.

**Nunca** exponer directamente estos RPC al cliente móvil como si las claves fueran de acceso público.

## Integridad
- Las claves de idempotencia UUID son obligatorias al crear paciente, visita y evolución. Reutilizar una con contenido distinto produce error.
- Restricción PostgreSQL `EXCLUDE USING gist` evita asignaciones simultáneas del mismo profesional en horarios superpuestos. Visitas canceladas/no realizadas no bloquean cupos.
- Las notas clínicas guardan versiones separadas: no actualizaciones destructivas.
- La etapa de revisión **no** equivale a firma electrónica, firma digital ni cierre verificado.
- No se emiten ni almacenan PDFs, certificados o archivos de firma en este gate.

## QA automatizado en GitHub
1. Preparación de entorno PostgreSQL 16 con `auth.users` sintético y rol `service_role` simulado.
2. Verificación previa `SUPA-01`: RLS, aislamiento, roles, revocación, denegaciones y FK entre organizaciones.
3. Aplicación de migración `20261010010000_operational_commands.sql`.
4. Ejecución `operational_commands.sql` con casos positivos y negativos: bypass cliente, cambio de actor, abuso de roles, reintentos, conflictos de keys, colisiones horarias, versión de notas, revocación, cierres/cancelaciones no autorizados.
5. Prohibido declarar producto instalable o apto para pacientes solo por estos tests.

## Gate siguiente: SUPA-03
Implementar Edge Functions en TypeScript con Auth real validado, operaciones priorizadas, pruebas con JWT falso/revocado y entorno sintético, sin Supabase desplegado. Después crear panel administrativo en app con datos ficticios y conexión opcional bloqueada por flag hasta staging.

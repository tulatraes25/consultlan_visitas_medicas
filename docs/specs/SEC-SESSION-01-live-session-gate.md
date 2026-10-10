# SEC-SESSION-01 — Verificación de sesión Auth activa (no solo JWT)

**SPEC/Kiro · 2026-10-10 · GitHub-first · Supabase autónomo, sin datos reales.**

## Hallazgo
Según la documentación oficial de Supabase, cerrar sesión revoca los refresh tokens, pero un access JWT puede seguir siendo válido hasta su expiración. La función Edge actual verifica la identidad contra `/auth/v1/user`, sin consultar expresamente la presencia de su `session_id` en la tabla de sesiones vigente. Para una aplicación pediátrica con datos de salud, esto es una brecha de defensa en profundidad.

Referencia: https://supabase.com/docs/guides/auth/sessions

## Objetivo e invariantes
- Todos los comandos permitidos en `supabase/functions/visits` deben exigir **tanto** usuario validado por Supabase Auth **como** sesión activa para ese usuario, determinada por un control backend confiable.
- JWT con `session_id` ausente, UUID inválido, `sub` discordante o vencido: DENY. Prohibido confiar en decodificación JWT sin antes verificar firma/identidad con Auth.
- El dispositivo no puede suministrar usuario, `session_id` o rol mediante body; provienen del JWT firmado y del usuario confirmado por Auth.
- Sólo `service_role` del backend podrá ejecutar la RPC `api_is_live_session(p_user,p_session)`. No conceder a `anon` o `authenticated`.
- RPC consulta **exclusivamente** `auth.sessions` del Supabase propio. Ausencia del registro, actor distinto o error de proveedor => DENY. No escribir/crear sesiones, ni hacer onboarding clínico.
- Edge deja de despachar cualquier comando mientras esta verificación falle; no se fía de un access token que permanezca formalmente sin vencer tras `signOut`.
- Códigos HTTP: identidad no autenticada → 401; si Auth o RPC indisponibles → 503 (sin detalles internos); jamás caer en "permitir por defecto".
- Mantener aislamiento de episodio, membresía y RLS existentes; sesión activa es condición necesaria, **no suficiente** para autorización clínica.
- El esquema local de Auth usado por PostgreSQL CI es un stub sintético, no migración a ejecutar contra Supabase real.
- No activar pacientes verdaderos, aprobaciones médicas, formularios clínicos ni firmas.

## Diseño y tareas
1. `20261010070000_live_auth_session_gate.sql`: RPC de verificación, `SECURITY DEFINER`, `search_path` vacío, grants restringidos, sin mutaciones.
2. `postgres_auth_stub.sql`: tabla `auth.sessions` exclusivamente de CI con referencia a usuarios ficticios.
3. `live_auth_session_gate.sql`: pruebas PostgreSQL de sesión existente, suprimida, ajena, UUID nulo y denegación de mobile roles.
4. `supabase/functions/visits/session.ts`: helper puro para extraer `sub/session_id/exp` de un JWT **únicamente después** de confirmar la identidad con Auth.
5. `index.ts`: consulta backend privada de sesión activa antes de retornar identidad a la política Edge. No se agregan nuevas acciones de usuario.
6. `session.test.ts`: pruebas Deno negativas, desajuste, expiry y escenario sintético permitido.
7. CI: migración y tests SQL después de SUPA-04B, typecheck/test Deno, Node/Expo existentes; actualizar secuencia de migraciones y runbook.

## Gate
El código puede quedar `GITHUB_TESTED` tras CI. **No** `CLOSED_CERTIFIED` sin push CI verificable y **no** `STAGING_VERIFIED` sin validar tablas/sesiones reales de la versión Supabase elegida. `CLINICALLY_READY` sigue bloqueado por autorizaciones médicas, legal/privacidad, identidad de responsables y firmas.

## Riesgo
La semántica exacta de la tabla administrada `auth.sessions` y los privilegios del proyecto deberán verificarse en staging; fallar cerrado si hay incompatibilidad. JWT autenticado y sesión activa no sustituyen comprobaciones de matrícula, episodio, organización ni rol.

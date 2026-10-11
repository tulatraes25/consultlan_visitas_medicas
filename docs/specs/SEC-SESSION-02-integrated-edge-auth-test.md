# SEC-SESSION-02 — Prueba de integración Auth + sesión activa + Edge

**SPEC/Kiro, datos sintéticos únicamente.** Complementa SEC-SESSION-01 con prueba de integración en Deno, sin proyecto Supabase creado y sin habilitación clínica.

## Objetivo
Comprobar a nivel de gateway que el usuario verificado por Auth y la fila activa de `auth.sessions` deben coincidir ANTES de ejecutar una operación administrativa. Los tests unitarios de decodificación y las pruebas PostgreSQL aisladas no alcanzaban para verificar por sí solos el orden y el efecto de este control.

## Contrato
1. El runtime de Edge invoca primero Auth (`GET /auth/v1/user`) con JWT y llave publishable, y no acepta user metadata como autoridad.
2. Solo tras Auth válido extrae del JWT `sub`, `session_id`, `exp` y verifica RPC privada `api_is_live_session(p_user,p_session)` usando el secreto del servidor; el endpoint no proviene del cliente.
3. Ausencia de sesión (respuesta booleana false), token expirado, usuario equivocado, Auth rechazado, RPC caída o respuesta malformada → NO se ejecuta comando.
4. Sólo `true` booleano exacto permite que el handler despache el nombre fijo `api_hc_create_episode_draft` con `p_actor` deducido de Auth.
5. Tests Deno con fetch simulado prueban que la consulta de Auth precede a la sesión, y que el comando ocurre únicamente después de ambos checks. Nunca usan firmas reales, claves o pacientes.
6. `session_id` y `sub` nunca se aceptan desde body móvil. Clave `service_role` no se incorpora al bundle.
7. No cambiar migraciones ni políticas de aprobaciones médicas; no publicar, no desplegar.
8. CI de cuatro jobs en SHA exacto; merge normal y revisión posterior al merge, sin declarar certificación completa cuando falte acceso a ejecución push.

## Implementación
- `supabase/functions/visits/authentication.ts`: adaptador puro con fetch inyectable, conectado a la Edge real.
- `supabase/functions/visits/authentication.test.ts`: integración Deno Auth → sesión → handler → comando de prueba.
- `supabase/functions/visits/index.ts`: utiliza este adaptador sin cambiar acciones autorizadas.
- `.github/workflows/quality-gate.yml`: nuevo archivo añadido a `deno check` y `deno test`.

## Bloqueos y riesgos restantes
La autenticación real de Supabase, revocación inmediata de sesiones, esquema administrado `auth.sessions`, vencimiento, latencia, manejo de fallos, rotación de claves y disponibilidad deben verificarse en **staging independiente** antes de utilizar información sanitaria. Esta prueba verifica orquestación con servidores simulados, no seguridad de un Supabase real. La autorización médica y el expediente electrónico siguen fuera de alcance.

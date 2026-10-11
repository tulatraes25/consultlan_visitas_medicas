# SEC-READ-02B — Último SELECT directo revocado y verificación de episodios por Edge

**SPEC/Kiro · 2026-10-10 · implementación GitHub-first para CI sintética, sin Supabase desplegado.**

## Objetivo
Eliminar la única excepción que quedó en SEC-READ-02A: `authenticated` todavía podía leer `homecare_episodes` directamente, aunque su JWT perteneciera a una sesión ya cerrada. Mantener la capacidad de probar aislamiento entre dos organizaciones ficticias sin permitir acceso directo al registro de episodios.

## Requisitos y modelo de amenazas
- Independencia total respecto del servidor Pediatrics ambulatorio. Cero pacientes verdaderos; solo fixtures inventados.
- Migración aditiva `20261010100000_episode_scope_edge_read.sql` en un Supabase nuevo: `REVOKE SELECT` sobre `homecare_episodes` a `public`, `anon`, `authenticated`. Después de HC-READ-01 y SEC-READ-02A, ninguna de las 14 tablas públicas de este esquema debe conservar SELECT directo por JWT.
- Nueva RPC `api_hc_episode_scope(p_actor,p_episode)` con `SECURITY DEFINER`, `search_path=''`, EXECUTE exclusivo de `service_role`. No usar permisos RLS implícitos al correr como propietario: SQL comprueba explícitamente organización activa, membresía activa y rol ADMIN/COORDINATOR de la misma organización, o profesional activo que integra el equipo activo en un episodio ACTIVE/SUSPENDED. Auditor, identidad inexistente o sin membresía → 403.
- La RPC devuelve exclusivamente `[{id,organization_id}]` para episodio permitido, y `[]` para otro episodio, incluso de una segunda organización. Nunca incluye paciente, notas, domicilios, identidad profesional, medicamentos o firma. Sin INSERT, UPDATE ni DELETE.
- Nueva acción allowlisted en la Edge `inspectMyHomecareEpisodeScope`, con un único parámetro `episodeId` UUID. `p_actor` procede del verificador Auth + presencia actual en `auth.sessions`, nunca del cuerpo enviado por el móvil. El origen/credenciales privilegiadas siguen exclusivamente en la Edge.
- STAGING-01B deja de hacer GET directo para la lectura positiva: sustituir por 4 POST Edge de alcance, controles de identidad Auth, rechazo de JWT ausente/vencido y **14 GET directos con `?select=*&limit=0`** que no solicitan registros y exigen rechazo HTTP 401/403. Cualquier 200 o respuesta no concluyente bloquea.
- Mantener `--ci` y `--check-env` sin acceso de red. `--probe` requiere opt-in explícito y debe ejecutarse manualmente con credenciales sintéticas en proyecto autorizado. La CLI nunca vuelca JWT, referencias, URLs privadas ni JSON clínico.

## Pruebas de aceptación
1. PostgreSQL 16 ejecuta las once migraciones en orden, mantiene RLS habilitado en catorce tablas y verifica `has_table_privilege` negativo para `authenticated` y `anon` en todas.
2. Prueba negativa real SELECT de `homecare_episodes` como `authenticated` con un UUID de actor; EXECUTE RPC directo desde `authenticated` y `anon` denegado.
3. Prueba SQL positiva no vacía y proyección exacta bajo `service_role` con ADMIN A, profesional A y profesional B de otra organización. Ambas lecturas cruzadas devuelven `[]`. DRAFT solo visible al administrador del tenant, no a profesional no asignado.
4. Membresía revocada, equipo desactivado y organización suspendida bloquean o vacían la consulta, sin cambios en claims JWT.
5. Deno verifica Auth→sesión activa→RPC, control exacto del UUID y denegación de actor/organización/rol/clave privilegiada enviados por el móvil.
6. Node prueba con mocks las 22 solicitudes de STAGING-01B, seis campos de entorno, dos resultados positivos, dos resultados cruzados vacíos, sin JWT, token vencido, JSON extra o malformado y **todos** los 14 posibles permisos directos filtrados. Si un GET de límite cero responde 200, el gate falla.
7. Quality Gate completo: contratos privacidad Node, PostgreSQL, Deno Edge y Expo React Native/Android/iOS JS. PR normal, SHA HEAD fijo, sin merge hasta 4/4 success. La certificación `CLOSED_CERTIFIED` además requiere pruebas `push` posmerge verificadas.

## Advertencias
El test STAGING-01B ahora demuestra **Edge/SQL scope más denegación PostgREST**, no el comportamiento remoto íntegro de cada RLS. Las políticas RLS siguen siendo ensayadas en PostgreSQL CI y deben someterse a inspección y pruebas de roles en el Supabase real. No utilizar un nombre de gate anterior para afirmar más de lo probado.

Permanecen pendientes proyecto Supabase staging autorizado, esquema administrado Auth, sesiones reales cerradas, MFA, backup/restore, Storage privado, consentimiento, habilitación profesional, firma certificada, disponibilidad, evaluación clínica/legal y funcionamiento en dispositivos reales. **No-go absoluto para pacientes y actos asistenciales reales.**

## Próximo gate
**STAGING-01D** — bootstrap manual verificable del Supabase independiente y ensayo real con entidades sintéticas A/B; constatar migraciones, grants, identidad y validación de `auth.sessions` sin subir credenciales al repositorio. No corresponde fingir ni ejecutar ese despliegue desde CI.

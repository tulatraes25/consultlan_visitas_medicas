# STAGING-01C — Revocación efectiva de sesión Auth en Edge

**SPEC/Kiro · 2026-10-10. Estado: mecanismo de prueba implementado, sin ejecución remota.**
**Ámbito:** aplicación autónoma de internación domiciliaria pediátrica. Supabase propio; cero pacientes reales y cero importaciones de la clínica ambulatoria.

## Objetivo
Demostrar en un staging autorizado que la Edge acepta una sesión de prueba activa pero niega una segunda sesión del **mismo usuario** que ya fue cerrada, aunque el JWT de acceso de esa sesión cerrada todavía no haya vencido. Esto pone a prueba el gate SEC-SESSION-01/02 en un servicio real en vez de afirmar que Deno/PostgreSQL aislados bastan.

## Requisitos y restricciones
1. Se exige la validación completa STAGING-01A: ref de Supabase de **20 caracteres**, origen exactamente `https://<ref>.supabase.co`, lista de proyectos excluidos, llave `sb_publishable_` y declaraciones `STAGING_ENVIRONMENT=staging`, `STAGING_OPERATOR_APPROVED=YES`, `STAGING_NO_REAL_PATIENTS=YES`. Nunca aceptar claves `service_role` o `sb_secret_`.
2. Se deben preparar **en forma manual por operador autorizado** dos sesiones distintas de una única cuenta ficticia del Supabase nuevo. La sesión A debe permanecer activa, y la B debe ser terminada de forma comprobable **sin destruir A**. Conservar temporalmente solo en gestor seguro los JWT de A/B (ambos todavía no vencidos, al menos 120 s adicionales) y un tercer JWT vencido; no renovar automáticamente el token B.
3. Opt-in adicional `STAGING_SYNTHETIC_FIXTURES=YES`, `STAGING_SESSION_E2E=YES`, `STAGING_SESSION_REVOCATION_CONFIRMED=YES`. Para ejecutar red también `STAGING_ALLOW_NETWORK=YES` y bandera explícita `--probe`.
4. Verificación offline: formato JWT (sin confiar en firma decodificada), mismo `sub` sintético, diferentes `session_id` para A/B, `role=authenticated`, JWT A/B no vencidos y tercer JWT ya vencido. Todas las firmas reales se verifican remotamente mediante Supabase Auth.
5. Se hacen exactamente seis requests a URLs fijas del proyecto validado: dos GET Auth para A/B; cuatro POST Edge con **acción deliberadamente inexistente** bajo JWT A, JWT B, JWT vencido y sin JWT. Ninguno llama una RPC conocida, registra una prestación o transmite contenido clínico. El cuerpo HTTP es siempre `{"action":"__staging_session_negative_only__"}`.
6. `/auth/v1/user` debe validar identidad A y B con **el mismo UUID** y `is_anonymous != true`. Si Auth rechaza por sí mismo B, el gate queda **inconcluso**, pues no demuestra el control adicional de sesión de la Edge.
7. La Edge con JWT A debe devolver **422** con cuerpo de error exacto `INVALID_OPERATION_OR_FIELDS`. Con JWT B, JWT expirado o sin JWT debe responder **401/403**. Cualquier `200`, `422` con B, acceso lateral, timeout, error de red, identidad cruzada o payload inesperado bloquea.
8. No enviar tokens por CLI argumentos, querystring, issue, chat, archivo versionado o logs. La herramienta no imprime JWT, ref, URL, paciente, respuesta HTTP ni stack. Redirecciones prohibidas y caché desactivada.

## Archivos y comandos
- `src/operations/staging-session-policy.mjs`: validador y seis comprobaciones con `fetch` inyectable.
- `scripts/staging-session-verify.mjs`: CLI sin red por defecto.
- `test/staging-session-policy.test.mjs`: pruebas Node totalmente sintéticas de éxito/fracaso, destinos exactos, opt-in, sesiones y ausencia de mutación deliberada.
- Quality Gate: `node --check`, `node scripts/staging-session-verify.mjs --ci` y `npm test` más jobs PostgreSQL/Deno/Expo existentes.

Sin red:
```bash
node scripts/staging-session-verify.mjs --ci
node scripts/staging-session-verify.mjs --check-env
```
El segundo comando necesita las variables configuradas localmente por el operador y **no** usa la red.

Solo en staging sintético autorizado:
```bash
node scripts/staging-session-verify.mjs --probe
```

## Criterios de aceptación
- CI sintética PASS en cabeza exacta del PR.
- No se ejecuta ni crea proyecto Supabase desde ChatGPT/GitHub CI; no hay secretos alojados en GitHub.
- El resultado real requiere evidencia de identidad del staging, aprobaciones, configuración y sesión B cerrada; la palabra PASS de la CLI no sustituye auditoría ni hace la app apta para atención.
- PR normal con HEAD auditado, cuatro jobs PR y push CI posterior al merge; sin última comprobación se registra `MERGED_PR_CI_PASS_POST_MAIN_UNVERIFIED`.

## Límites y siguiente gate
El test no crea cuentas, no borra sesiones, no verifica por sí solo el respaldo/restauración, la retención, los permisos de todos los profesionales ni firmas. Si el proveedor deja de aceptar B incluso en Auth, el resultado será inconcluso y habrá que rediseñar la prueba de revocación sin forzar escrituras peligrosas a `auth.sessions`. Próximo paso: pruebas end-to-end en Supabase staging realmente autorizado, previa aprobación institucional.

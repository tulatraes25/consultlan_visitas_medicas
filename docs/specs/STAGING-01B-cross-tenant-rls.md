# STAGING-01B — Aislamiento de episodios mediante Edge y cierre PostgREST

**SPEC/Kiro · contrato reemplazado en SEC-READ-02B · sin despliegue real.**

## Cambio obligatorio de arquitectura

La versión inicial de STAGING-01B utilizaba GET autenticado a `/rest/v1/homecare_episodes` para probar RLS no vacío con dos organizaciones. Esta lectura directa no puede comprobar en todo momento la presencia de `session_id` en `auth.sessions`, por lo que conserva el riesgo de un JWT firmado, pero cerrado en Auth. **SEC-READ-02B elimina ese último SELECT directo**; la prueba funcional pasa exclusivamente por Edge con Auth y sesión activa verificada, y las pruebas de seguridad incluyen denegación estricta de acceso directo a las 14 tablas públicas. El test remoto **no equivale a comprobar todas las políticas RLS directamente**; las pruebas de RLS existentes se ejecutan por separado en PostgreSQL CI con fixtures sintéticos.

## Requisitos y restricciones
1. El proyecto debe ser un nuevo Supabase *exclusivo* de internación domiciliaria, sin usuarios/pacientes del servidor clínico ambulatorio. STAGING-01A comprueba referencia HTTPS exacta, exclusiones y `sb_publishable_` sin secretos. Solo `--probe` con `STAGING_RLS_E2E=YES`, `STAGING_SYNTHETIC_FIXTURES=YES`, `STAGING_ALLOW_NETWORK=YES`, `STAGING_OPERATOR_APPROVED=YES` permite red.
2. El operador autorizado prepara dos organizaciones ficticias A/B, con episodios ficticios existentes y dos cuentas activas distintas de sus respectivas organizaciones: `ADMIN`/`COORDINATOR` o profesional **activo y asignado al equipo de un episodio activo/suspendido**. Cada cuenta tendrá un JWT válido asociado a una sesión activa del mismo staging. Se dispone además de un JWT vencido de ensayo.
3. Nunca subir JWT, claves, nombres, datos médicos ni IDs vinculables a personas reales a GitHub, logs o chats. Las variables locales `STAGING_USER_A_ID`, `STAGING_USER_B_ID`, `STAGING_ORGANIZATION_A_ID`, `STAGING_ORGANIZATION_B_ID`, `STAGING_EPISODE_A_ID`, `STAGING_EPISODE_B_ID`, `STAGING_USER_A_JWT`, `STAGING_USER_B_JWT`, `STAGING_EXPIRED_USER_JWT` provienen de un gestor seguro y deben corresponder solo a fixtures inventados.
4. Validar ambas identidades primero mediante `GET /auth/v1/user`, exigiendo UUID correspondiente y no anónimo. Nunca autenticar confiando únicamente en un JWT decodificado localmente.
5. Ejecutar cuatro **POST Edge de solo lectura** a `/functions/v1/visits`, cuerpo exacto `{"action":"inspectMyHomecareEpisodeScope","episodeId":"<UUID>"}`, sin identificador de organización, rol, paciente ni actor. La Edge valida JWT, exige sesión presente en Auth y añade `p_actor` por su cuenta. El SQL consulta exclusivamente el episodio indicado si está permitido por membresía, organización y/o equipo real del usuario.
6. Cada cuenta debe recibir `{ok:true,result:[{id,organization_id}]}` **exactamente** para el episodio de su propia organización. Consultar el episodio de la organización ajena debe devolver `{ok:true,result:[]}`. Nunca aceptar un resultado vacío como control positivo; los objetos tienen únicamente dos claves. Un 200 ajeno con fila constituye fuga y bloquea el gate.
7. El mismo POST Edge sin JWT debe ser 401/403. El JWT vencido debe recibir 401/403 de `GET /auth/v1/user`; no inferir que está vencido porque una tabla no devolvió datos.
8. Después ejecutar **14 GET a PostgREST**, uno por tabla pública, con `?select=*&limit=0`, usando JWT A. Estas peticiones no recuperan ninguna fila, incluso en caso de permisos incorrectos. Exigir 401/403 para cada tabla. Un 200 con `[]` **no demuestra denegación**, constituye fallo. Un error de red, 404 o 5xx también bloquea por evidencia inconclusa. La lista fija incluye organizaciones, membresías, profesionales, pacientes, visitas, notas, constancias, auditoría, episodios, equipo, versiones de plan, solicitudes de revisión, coberturas y relevos.
9. Total **22 peticiones fijas**: 2 Auth de identidad + 4 Edge de alcance + 1 Edge sin JWT + 1 Auth vencido + 14 PostgREST de límite 0. Todas HTTPS de destino exacto, `redirect:error`, `cache:no-store`, timeout 8 s. No ejecutar un comando médico, escritura, reset, migración ni aprobación.
10. `--ci`: únicamente contratos Node simulados, sin red. `--check-env`: solo validación local. `--probe`: ejecución real permitida únicamente a operador autorizado con staging aislado y prueba de que no se utilizan pacientes verdaderos.

## Archivos y verificación
- `src/operations/staging-rls-policy.mjs`: verificador completo con 22 requests, validación estricta del JSON y comprobación de 14 denegaciones.
- `test/staging-rls-policy.test.mjs`: tests sin red de positivos no vacíos, fugas cruzadas, campos extra, errores y 200 incorrecto en cada tabla.
- `scripts/staging-rls-verify.mjs`: interfaz segura `--ci / --check-env / --probe`.
- `supabase/migrations/20261010100000_episode_scope_edge_read.sql`: RPC servidor `api_hc_episode_scope` y revocación de SELECT de episodios.
- `supabase/tests/episode_scope_edge_read.sql`: RLS habilitado en catorce tablas, permisos SQL de la RPC, dos organizaciones, rol prohibido, membresías/equipos revocados y proyección mínima.
- `supabase/functions/visits/handler.ts`: allowlist `inspectMyHomecareEpisodeScope` con único `episodeId`; actor servidor.
- `supabase/functions/visits/authentication.test.ts`: Auth→sesión viva→RPC y rechazos.

## Riesgos y NO-GO
Las pruebas de GitHub no certifican el comportamiento en Supabase administrado. **STAGING_EDGE_SCOPE_VERIFIED** requiere `--probe` real más inspección independiente del proyecto Supabase, identidad, RLS, grants y esquemas. La prueba Edge demuestra el aislamiento de la RPC; **no** demuestra que cada política RLS interna se ejecute desde PostgREST. Los ejercicios de RLS reales de PostgreSQL 16 en CI no sustituyen ensayo en Supabase alojado, con sus extensiones y roles de Auth.

Persisten aprobación institucional y médica, legalidad del tratamiento de datos de menores, validación de profesionales, backups/restauración, almacenamiento privado, disponibilidad, alarmas, firmas y seguridad operativa. Sin pacientes verdaderos ni activación clínica.

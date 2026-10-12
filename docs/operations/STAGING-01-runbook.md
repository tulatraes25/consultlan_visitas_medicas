# STAGING-01 — Runbook de ambiente de pruebas autónomo

**Estado:** PREPARACIÓN, no proyecto creado ni implantación clínica habilitada.
**Responsable:** institución titular Pediatrics + operador de infraestructura expresamente autorizado.
**Fuente:** repositorio `tulatraes25/consultlan_visitas_medicas`; no servidor CONSULTLAN, no clínica ambulatoria, no SICOM.

## 0. Gates previos (bloqueantes)
- Confirmar por escrito que el nuevo proyecto Supabase pertenece al programa de internación domiciliaria pediátrica y **no comparte** organización/usuarios/pacientes/credenciales con consultorios Pediatrics.
- Responsables administrativo, médico, seguridad y protección de datos designados; aprobación de región y proveedores, condiciones de tratamiento de datos de salud, política de retención, backups/restauración, contratos y respuesta a incidentes.
- Staging vacío, con datos exclusivamente sintéticos. Deshabilitar registro abierto y cuentas anónimas cuando aplique, revisar MFA para administradores, revocación de sesiones y privilegios mínimos. No cargar información de niños verdaderos.
- Verificar identidad de proyecto en panel de Supabase. Guardar referencia de proyecto en gestor seguro, nunca en archivos versionados.
- Identificar todos los refs de proyectos reales excluidos (producción de Pediatrics/CONSULTLAN, SICOM y demás recursos institucionales). Un simple "sí, es independiente" no constituye prueba.
- **No operar contra el servidor ni la base de la clínica ambulatoria.** Branding es lo único compartido.

## 1. Preflight sin credenciales (ya automatizado en GitHub)
Desde el repositorio limpio con Node >=22:
```bash
node scripts/staging-preflight.mjs --ci
npm test
```
El comando `--ci` no usa internet: comprueba el identificador **local** `project_id = "consultlan-visitas-medicas-local"`, `[functions.visits] verify_jwt = true`, las trece migraciones SQL y que se hayan retirado tanto las rutas Edge como los permisos SQL de cinco RPC clínicas históricas. Este identificador local **no** es una referencia de proyecto online.

GitHub Actions realiza además los tests RLS PostgreSQL 16 con Auth sintético, tests Edge Deno y typecheck/UI/exportación JS Android e iOS. No confundir bundles JS con un APK/IPA.

## 1D. STAGING-01D — huella de fuente y auditoría de catálogo (sin instalación)

Antes de que un operador toque un Supabase real, obtener un checkout Git **limpio** del commit aprobado de `main`. El script STAGING-01D no lee variables de credenciales ni contacta a Supabase: exige que las trece migraciones sean exactamente las esperadas, valida los archivos Edge/config y crea SHA-256 por archivo ligados al commit exacto.

```bash
node scripts/staging-source-attestation.mjs --ci
node scripts/staging-source-attestation.mjs --emit > /tmp/visitas-staging-source.json
node scripts/staging-source-attestation.mjs --verify /tmp/visitas-staging-source.json
```

Guardar el manifiesto fuera del repo bajo control institucional. Nunca usar el manifiesto de un commit diferente ni confundirlo con comprobante de instalación. Tras la instalación supervisada de las trece migraciones, el operador podrá ejecutar **solo en el Supabase staging cuya identidad fue comprobada** el SQL `supabase/staging/01d_catalog_readonly_attestation.sql`. Es transacción `READ ONLY`, inspecciona `pg_catalog`, compatibilidad de estructura Auth, RLS y privilegios; no extrae filas de pacientes ni sesiones. Un PASS significa **únicamente** que coincide la estructura observada, no que el ambiente esté aprobado o haya probado backups/Storage y Auth reales.

[SPEC STAGING-01D](../specs/STAGING-01D-source-and-catalog-attestation.md). Staging sigue pendiente de creación y autorización.

## 1E. STAGING-01E — Historia exacta de migraciones y aprobación previa

El SQL `supabase/staging/01e_migration_history_readonly.sql` verifica exclusivamente metadatos de `supabase_migrations.schema_migrations`: deben estar las **trece versiones exactas**, sin ninguna extra. GitHub lo ensaya con una tabla ficticia y fallos intencionales por versiones faltantes, extras y reemplazos. **No instala migraciones ni inspecciona pacientes.**

Una vez que el operador institucional haya identificado y aprobado un proyecto **nuevo** en el Dashboard, debe comprobar localmente la referencia enlazada y, sin mutar nada, ejecutar `supabase migration list --linked` y `supabase db push --dry-run`. Registrar el cotejo del destino y la revisión de cambios en un acta segura. No ejecutar `supabase db push`, `supabase functions deploy`, `db reset`, `migration repair` ni crear cuentas/pacientes antes de la autorización específica y del control de datos.

Solo **después** de la instalación supervisada de las trece migraciones, ejecutar el SQL de historial por una conexión segura al staging correcto, seguido del SQL STAGING-01D de catálogo. La coincidencia de versiones no acredita igualdad criptográfica de los scripts ejecutados: correlacionar con el manifiesto SHA-256 fuente, el dry-run revisado, el registro de aplicación y las pruebas de Auth/Edge. [SPEC STAGING-01E](../specs/STAGING-01E-migration-history-readiness.md).

## 1F. STAGING-01F — Suite integrada de seguridad (no ejecutada en Supabase remoto)

El gate `scripts/staging-integrated-verify.mjs` combina STAGING-01A/B/C en una misma ejecución de 30 solicitudes negativas o de solo lectura. Para evitar falsas certificaciones exige el mismo proyecto y los mismos JWT activos/vencidos del usuario A entre las pruebas de aislamiento y de sesión. No modifica datos.

El operador institucional deberá verificar fuera de GitHub la titularidad, región, referencia del proyecto Supabase nuevo y la lista de refs excluidos. Solo entonces establecer `STAGING_OPERATOR_PROJECT_IDENTITY_VERIFIED=YES`: una declaración humana que el programa no puede corroborar. También exige todas las variables de 01A/01B/01C, incluyendo `STAGING_SESSION_ACTIVE_JWT=STAGING_USER_A_JWT`, `STAGING_SESSION_EXPIRED_JWT=STAGING_EXPIRED_USER_JWT` y `STAGING_SESSION_USER_ID=STAGING_USER_A_ID`.

Modos: `node scripts/staging-integrated-verify.mjs --ci` no usa red ni credenciales; `--check-env` valida sin red; `--probe` requiere autorización y credenciales exclusivamente sintéticas gestionadas fuera del repositorio. El último modo NO fue ejecutado contra un proyecto real.

Un PASS confirma solamente los 30 comportamientos HTTP observados. Son exigencias adicionales las auditorías SQL de solo lectura 01D/01E, manifiesto SHA-256, respaldo/restauración, identidad institucional, configuración Auth/Storage y autorización de Dirección Médica. Nunca registrar JWT, claves o pacientes en GitHub ni en un acta pública. [SPEC STAGING-01F](../specs/STAGING-01F-integrated-identity-run.md).

## 2. Variables temporales requeridas, solo en entorno autorizado
No pasar llaves como argumentos, no usar archivos .env dentro del repositorio público, no pegar credenciales en chats, issues o logs. Usar el gestor de secretos del operador o un entorno de ejecución aislado.

| Variable | Propósito |
| --- | --- |
| `STAGING_ENVIRONMENT` | Valor exacto `staging` |
| `STAGING_PROJECT_REF` | Referencia del proyecto independiente, obtenida del Dashboard Supabase |
| `STAGING_URL` | Origen HTTPS exacto asociado a esa referencia, sin path, query ni puerto |
| `STAGING_FORBIDDEN_PROJECT_REFS` | Refs reales que **nunca** deben ser destino (separados por comas; debe haber al menos uno) |
| `STAGING_PUBLISHABLE_KEY` | **Solo** `sb_publishable_...` de este proyecto staging; nunca `sb_secret_` ni `service_role` |
| `STAGING_OPERATOR_APPROVED` | Valor exacto `YES`, declaración del operador |
| `STAGING_NO_REAL_PATIENTS` | Valor exacto `YES`, declaración del operador |

Comprobar localmente estas declaraciones sin red:
```bash
node scripts/staging-preflight.mjs --check-env
```
Resultado favorable = formato y declaraciones aceptados, **no** independencia/identidad verificadas remotamente.

## 3. Instalación inicial del proyecto staging (MANUAL, bloqueada)
Solo con autorizaciones y revisión de seguridad: crear un proyecto Supabase **nuevo**, habilitar Auth según política, verificar región, destinatarios, backups, restauración y políticas de Storage privado. No desplegar el proyecto SICOM, el servidor de Pediatrics ni los datos de consultorio.

Revisar las trece migraciones en orden y en staging vacío. No ejecutar `supabase db reset --linked`: es destructivo sobre el proyecto enlazado. No ejecutar `supabase db push` sin cotejo explícito de la referencia enlazada, revisión de cambios pendientes, backup de staging y aprobación del operador. Los datos sintéticos de `supabase/tests/postgres_auth_stub.sql` son **solo para PostgreSQL aislado de CI**; nunca aplicar ese shim en una base real Supabase.

Validar que el esquema `private` no esté expuesto; verificar `SECURITY DEFINER`, propietario/search_path, GRANT/REVOKE, RLS, auditoría, Auth, funciones Edge, cifrado, redes y separación de cuentas. No activar ningún documento clínico, permiso médico, firma o paciente real.

## 4. Smoke negativo opcional, después de instalar un staging independiente
El operador valida que todas las condiciones anteriores se cumplen, configura variables mediante un canal seguro y además habilita temporalmente:

`STAGING_ALLOW_NETWORK=YES`

Ejecutar expresamente:
```bash
node scripts/staging-preflight.mjs --probe
```

Este comando **NO** instala migraciones, no modifica pacientes ni planes, no importa datos, no autentica usuarios ni firma. Hace dos comprobaciones negativas contra el origen HTTPS exacto:

1. GET anónimo de un máximo de un identificador de episodio. Solo acepta 401/403 o 200 con arreglo JSON vacío. Un arreglo vacío puede reflejar tabla vacía: **NO es certificación RLS**.
2. POST Edge con acción deliberadamente desconocida y sin JWT de usuario. Solo acepta 401 o 403. No prueba el circuito con sesión válida ni la autorización clínica.

Las respuestas y los secretos no se imprimen ni se almacenan. Si falla una petición, la prueba bloquea; nunca se permite fallback a otro servidor.

## 4B. STAGING-01B — RLS no vacío con dos organizaciones (código preparado, NO ejecutado)

Este gate requiere que el operador prepare, **solo en staging**, dos organizaciones inventadas A/B, dos cuentas ficticias activas con membresía ADMIN o COORDINATOR en sus propias organizaciones, dos episodios ficticios existentes (uno por organización) y un token de acceso emitido previamente para una cuenta ficticia que **ya esté vencido** y cuyo payload incluya `exp` en el pasado. No agregar pacientes verdaderos ni contenido clínico. Confirmar que cada cuenta puede leer únicamente metadatos de su propio episodio y que los permisos siguen vigentes de manera deliberada.

Las variables del paso 2 continúan siendo obligatorias. Agregar de forma temporal y segura, sin guardar en el repo ni pegarlas en un chat:

- `STAGING_RLS_E2E=YES` y `STAGING_SYNTHETIC_FIXTURES=YES`.
- `STAGING_USER_A_ID`, `STAGING_USER_B_ID`: UUID de cuentas sintéticas diferentes de Auth de ESTE staging.
- `STAGING_ORGANIZATION_A_ID`, `STAGING_ORGANIZATION_B_ID`: UUID de organizaciones diferentes.
- `STAGING_EPISODE_A_ID`, `STAGING_EPISODE_B_ID`: UUID de episodios creados sintéticamente, uno para cada organización.
- `STAGING_USER_A_JWT`, `STAGING_USER_B_JWT`: JWT de sesiones activas sintéticas, proporcionados de manera segura al proceso.
- `STAGING_EXPIRED_USER_JWT`: JWT de una sesión de ensayo de este staging que se dejó expirar; su `exp` debe estar vencido.

En una terminal aislada con las variables provistas mediante un gestor seguro:

```bash
node scripts/staging-rls-verify.mjs --ci
node scripts/staging-rls-verify.mjs --check-env
# SOLO si el operador habilitó STAGING_ALLOW_NETWORK=YES:
node scripts/staging-rls-verify.mjs --probe
```

Con SEC-READ-02B, el modo `--probe` efectúa **22 solicitudes sin mutación**: 2 GET Auth para identidades, 4 POST Edge con RPC de alcance únicamente de lectura (propio y cruzado A/B), 1 POST anónimo denegado, 1 GET Auth de JWT vencido denegado y 14 GET PostgREST con `?select=*&limit=0`, cada uno obligatoriamente 401/403. Ninguna fila clínica se solicita; un GET a una tabla con 200 es fracaso incluso si devuelve `[]`. El test remoto demuestra alcance Edge/SQL y cierre de grants, no que todas las políticas RLS internas operen desde PostgREST. Nunca crea sesiones, usuarios, visitas, tratamientos ni documentos.

La validación de Auth por dos cuentas y un JWT vencido requiere credenciales reales **de ensayo**, que no están disponibles ni almacenadas en GitHub. Esto no puede considerarse certificado hasta su ejecución en el proyecto autónomo aprobado. Aun con PASS, persisten pruebas de permisos más finos para especialistas, Storage, backups, firmas y procedimientos.

**Advertencia sobre cierre de sesión:** Supabase puede mantener válido un JWT de acceso hasta su vencimiento aunque se haya ejecutado `signOut()`. Esta verificación **no** demuestra cierre inmediato de sesiones. Para comandos clínicos sensibles será necesaria una comprobación server-side de sesión activa (por ejemplo, con `session_id` y el estado autorizado de `auth.sessions`), estrategia de expiración y pruebas específicas antes de pacientes reales. No pedir JWT en chats ni almacenar token de prueba en repositorios. Ver [documentación oficial de sesiones](https://supabase.com/docs/guides/auth/sessions).


## 4C. SEC-SESSION-01 — Validación de sesión activa (código sintético, pendiente de staging)

Una sesión cerrada puede conservar un JWT de acceso formalmente válido hasta `exp`. Por eso la Edge ahora exige, después de verificar identidad en `/auth/v1/user`, una comprobación confiable de presencia del `session_id` del JWT para el mismo usuario en la tabla administrada `auth.sessions`. El verificador `api_is_live_session` es exclusivo de `service_role`. Si falta sesión, se revocó, el actor es distinto o el servicio de verificación falla, no se despacha el comando.

**Gate real pendiente:** verificar en Supabase staging la semántica actual de `auth.sessions`, ejecutar pruebas positivas con dos sesiones ficticias, terminar una de ellas y exigir rechazo con JWT todavía no expirado; repetir con membresía revocada. La prueba local en PostgreSQL usa un stub sintético, no el servicio Auth administrado. No se utilizarán datos de pacientes ni tokens reales en GitHub. [SPEC SEC-SESSION-01](../docs/specs/SEC-SESSION-01-live-session-gate.md).

## 4D. STAGING-01C — Prueba de revocación de sesión (solo mecanismo preparado)

El gate **STAGING-01C no se ha ejecutado contra un proyecto real**. Un operador autorizado deberá crear en el Supabase nuevo, aislado y sin datos de pacientes, una única cuenta ficticia con dos sesiones A/B distintas. Mantener A activa; terminar B deliberadamente antes de que venza su JWT de acceso, y verificar fuera de la aplicación que la sesión B ya no figura como activa. Conservar además un tercer JWT de ensayo que ya haya vencido. **No revocar ni editar manualmente filas internas de `auth.sessions` desde la CLI.** La validación de identidad y el cierre de sesión deben usar mecanismos soportados por el proveedor.

Además de las variables generales del paso 2, configurar temporalmente, por un gestor seguro y **nunca en GitHub ni en chats**:

- `STAGING_SYNTHETIC_FIXTURES=YES`, `STAGING_SESSION_E2E=YES`, `STAGING_SESSION_REVOCATION_CONFIRMED=YES`.
- `STAGING_SESSION_USER_ID`: UUID de la única cuenta ficticia de ensayo.
- `STAGING_SESSION_ACTIVE_JWT`: JWT de la sesión A, con al menos 120 segundos hasta vencimiento.
- `STAGING_SESSION_REVOKED_JWT`: JWT todavía no vencido de la sesión B que se cerró.
- `STAGING_SESSION_EXPIRED_JWT`: JWT antiguo de la misma cuenta, ya vencido hace al menos 120 segundos.

```bash
node scripts/staging-session-verify.mjs --ci
node scripts/staging-session-verify.mjs --check-env
# SOLO en el Supabase aislado, con STAGING_ALLOW_NETWORK=YES:
node scripts/staging-session-verify.mjs --probe
```

`--probe` realiza dos **GET de Auth** y cuatro POST Edge con acción deliberadamente desconocida, nunca un comando real: comprueba que A llegue al validador de acción, mientras B, JWT vencido y sesión anónima son rechazados. Si Supabase Auth **ya rechaza B**, el resultado queda **inconcluso para el control adicional de sesión**, aunque sea seguro: no declarar una prueba positiva del chequeo de `auth.sessions` sin evidencia. No se envían indicaciones, nombres de menores, firmas ni registros médicos.

SPEC: [STAGING-01C](../specs/STAGING-01C-session-revocation-probe.md). Esta prueba tampoco demuestra por sí sola RLS completo, backups/restauración ni aptitud clínica.

## 4E. HC-READ-01 — Consulta de coberturas solo a través de Edge (NO desplegada)

La novena migración `20261010080000_homecare_roster_edge_read.sql` revoca SELECT directo a `authenticated` y `anon` sobre `homecare_coverage_assignments` y `homecare_shift_handovers`. Su RPC histórica `api_hc_list_my_coverages` sigue con EXECUTE exclusivo del backend por trazabilidad de migraciones; **la acción Edge sin ventana `listMyHomecareCoverages` fue retirada por HC-READ-03 y responde 422**. No utilizarla para una agenda: al devolver solo las primeras cien coberturas antiguas podría ocultar prestaciones futuras. Solo están permitidas las acciones `listMyHomecareCoveragesPage` y `listMyHomecareCoveragesNextPage`, con ventana UTC estricta, cursor, JWT, sesión activa y revalidación del profesional en servidor. Devuelven como máximo seis metadatos por cobertura y ninguna información clínica.

Solo después de crear staging autónomo se podrá auditar externamente: SELECT directo negado tras logout, RPC actor propio, otra organización, membresía/profesional/equipo inactivos y JWT sin sesión. **La lectura directa de otras tablas (pacientes, episodios, notas/visitas) sigue siendo un riesgo pendiente de SEC-READ-02; no usar pacientes reales.** [SPEC HC-READ-01](../specs/HC-READ-01-session-scoped-roster.md).

## 4F. SEC-READ-02A — Cierre de acceso directo a once tablas adicionales

La décima migración `20261010090000_close_direct_sensitive_reads.sql` revoca lectura directa a `authenticated`/`anon` sobre organizaciones, membresías, profesionales, pacientes, visitas, notas, constancias, auditoría, equipo de episodio, versiones de plan y solicitudes de revisión. Sumadas a las dos tablas de HC-READ-01, son **trece tablas sin SELECT móvil directo**. Las funciones `SECURITY DEFINER` conservan sus autorizaciones individuales y la Edge su verificación de sesión.

**Antecedente de SEC-READ-02A, RESUELTO por SEC-READ-02B:** aquella migración preservó temporalmente SELECT sobre `homecare_episodes` para un verificador antiguo. La migración siguiente lo revoca y sustituye la prueba remota por Edge y 14 comprobaciones de acceso directo denegado. Esta solución aún requiere ensayo real de staging con datos ficticios. [SPEC SEC-READ-02A](../specs/SEC-READ-02A-sensitive-table-lockdown.md).

## 4G. SEC-READ-02B — Eliminación de la última excepción (NO desplegada)

La undécima migración `20261010100000_episode_scope_edge_read.sql` revoca SELECT directo de `authenticated`/`anon` en `homecare_episodes`: quedan **14 tablas sin SELECT directo móvil**. Para preservar el control positivo no vacío entre dos organizaciones, agrega `api_hc_episode_scope`, exclusiva del backend y capaz de devolver únicamente `id` y `organization_id` del episodio autorizado. La Edge expone `inspectMyHomecareEpisodeScope` solo con `episodeId`; verifica Auth, sesión activa y suministra el actor. La consulta a otro tenant produce arreglo vacío. STAGING-01B, con proyectos reales de prueba, además exige **401/403 de cada GET directo de límite cero**. No prueba por sí solo la configuración real de Auth/RLS/retención en Supabase alojado y no autoriza datos verdaderos. [SPEC SEC-READ-02B](../specs/SEC-READ-02B-episode-edge-gate.md).

## 5. Aceptación de STAGING-01B/01C (todavía NO cumplida)
- Mostrar evidencia de proyecto autónomo, titularidad, región, políticas y datos ficticios. Confirmar identidad contra proyectos excluidos por medios independientes.
- Ejecutar RLS real con **dos organizaciones y usuarios ficticios distintos**: lectura permitida para el propio equipo; lectura de otro caso, usuarios desactivados, anon y acceso transversal denegados. Usar casos con filas sintéticas para evitar falsos verdes por tablas vacías.
- Ejercitar Edge con JWT real de usuario ficticio: válido, vencido, revocado, ajeno, sin membresía y credenciales de servicio mal ubicadas; denegar operaciones no autorizadas.
- Inspeccionar migraciones finales, políticas Storage privadas, backup y **restauración** documentada.
- Validar la app Expo en dispositivo de desarrollo sin escribir datos clínicos, y verificar el runtime contra el commit exacto de CI.
- Dirección Médica, legal y seguridad deben aprobar el circuito para una futura prueba con pacientes reales; **ni CI verde ni staging crean autorización clínica**.

## Fuentes técnicas de referencia
- [Supabase CLI: flujo local y precaución de reset remoto](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase: Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase: autorización de Edge Functions](https://supabase.com/docs/guides/functions/auth-headers)
- [Supabase: configuración local CLI](https://supabase.com/docs/guides/local-development/cli/config)

**No-go absoluto:** proyecto no identificado, referencias no excluidas, pacientes reales, credencial privilegiada en app, Auth de otra base, firma médica simulada o migración destructiva sin aprobación.

## HC-READ-02 — Regla de instalación con paginación

Toda revisión de un Supabase staging autorizado debe incluir la migración **12 de 13** `20261011100000_homecare_roster_keyset_read.sql` y la **13 de 13** `20261011110000_homecare_attendance_template_preview.sql`, respetando las once versiones anteriores sin reescribirlas. La primera incorpora paginación por cursor y ventana UTC no mayor a 32 días; la segunda resuelve exclusivamente en backend la estructura de la planilla de una cobertura propia autorizada. Auth/Edge debe revalidar sesión en cada página y en cada consulta de planilla. El catálogo 01D, el manifiesto de fuente y el ledger 01E cotejan el conjunto **exacto de trece versiones**; destinos con once, doce, catorce o versiones ajenas quedan bloqueados. El límite legado de cien coberturas históricas no debe utilizarse para una agenda asistencial completa.

Los rangos UTC son parámetros estrictamente operativos de staging y no una decisión sobre turnos, feriados, urgencias ni documentación médica. Un cursor no concede alcance adicional; se vuelven a comprobar profesionales, membresía, equipo y episodio. No se garantiza snapshot entre páginas si coordinación modifica el roster durante una consulta; se debe refrescar la ventana, no declarar continuidad clínica ininterrumpida.

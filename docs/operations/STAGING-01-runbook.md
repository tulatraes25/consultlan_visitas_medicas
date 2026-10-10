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
El comando `--ci` no usa internet: comprueba el identificador **local** `project_id = "consultlan-visitas-medicas-local"`, `[functions.visits] verify_jwt = true`, las siete migraciones SQL y que se hayan retirado tanto las rutas Edge como los permisos SQL de cinco RPC clínicas históricas. Este identificador local **no** es una referencia de proyecto online.

GitHub Actions realiza además los tests RLS PostgreSQL 16 con Auth sintético, tests Edge Deno y typecheck/UI/exportación JS Android e iOS. No confundir bundles JS con un APK/IPA.

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

Revisar las siete migraciones en orden y en staging vacío. No ejecutar `supabase db reset --linked`: es destructivo sobre el proyecto enlazado. No ejecutar `supabase db push` sin cotejo explícito de la referencia enlazada, revisión de cambios pendientes, backup de staging y aprobación del operador. Los datos sintéticos de `supabase/tests/postgres_auth_stub.sql` son **solo para PostgreSQL aislado de CI**; nunca aplicar ese shim en una base real Supabase.

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

Este gate requiere que el operador prepare, **solo en staging**, dos organizaciones inventadas A/B, dos cuentas ficticias activas con membresía ADMIN o COORDINATOR en sus propias organizaciones, dos episodios ficticios existentes (uno por organización) y un token de prueba de otra cuenta que se haya revocado. No agregar pacientes verdaderos ni contenido clínico. Confirmar que cada cuenta puede leer únicamente metadatos de su propio episodio y que los permisos siguen vigentes de manera deliberada.

Las variables del paso 2 continúan siendo obligatorias. Agregar de forma temporal y segura, sin guardar en el repo ni pegarlas en un chat:

- `STAGING_RLS_E2E=YES` y `STAGING_SYNTHETIC_FIXTURES=YES`.
- `STAGING_USER_A_ID`, `STAGING_USER_B_ID`: UUID de cuentas sintéticas diferentes de Auth de ESTE staging.
- `STAGING_ORGANIZATION_A_ID`, `STAGING_ORGANIZATION_B_ID`: UUID de organizaciones diferentes.
- `STAGING_EPISODE_A_ID`, `STAGING_EPISODE_B_ID`: UUID de episodios creados sintéticamente, uno para cada organización.
- `STAGING_USER_A_JWT`, `STAGING_USER_B_JWT`: JWT de sesiones activas sintéticas, proporcionados de manera segura al proceso.
- `STAGING_REVOKED_USER_JWT`: JWT obtenido previamente de una sesión de ensayo que fue efectivamente revocada.

En una terminal aislada con las variables provistas mediante un gestor seguro:

```bash
node scripts/staging-rls-verify.mjs --ci
node scripts/staging-rls-verify.mjs --check-env
# SOLO si el operador habilitó STAGING_ALLOW_NETWORK=YES:
node scripts/staging-rls-verify.mjs --probe
```

El modo `--probe` ejecuta **únicamente GET**: verifica identidades actuales ante `/auth/v1/user`, lectura no vacía del propio episodio (id y organization_id), lectura vacía del episodio ajeno en ambas direcciones, ausencia de acceso anónimo a una fila conocida y rechazo del token revocado. Cualquier fallo bloquea. Nunca crea sesiones, usuarios, visitas, tratamientos ni documentos.

La validación de Auth por dos cuentas y una sesión revocada requiere credenciales reales **de ensayo**, que no están disponibles ni almacenadas en GitHub. Esto no puede considerarse certificado hasta su ejecución en el proyecto autónomo aprobado. Aun con PASS, persisten pruebas de permisos más finos para especialistas, Storage, backups, firmas y procedimientos.

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

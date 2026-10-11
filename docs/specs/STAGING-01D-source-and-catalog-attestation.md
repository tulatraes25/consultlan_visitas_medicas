# STAGING-01D — Atestación de fuente y catálogo del Supabase independiente

**SPEC/Kiro · 2026-10-11 · GitHub-first · exclusivamente offline y SQL de solo lectura.**

## Objetivo y límite

Antes de crear o instalar el Supabase nuevo de internación domiciliaria, producir una huella reproducible del **commit exacto y de los bytes que se pretende instalar**, y disponer de una auditoría de estructura del proyecto una vez aplicado el esquema. Ninguna parte de este gate crea pacientes, usuarios, secretos, bases, servicios o despliegues.

La aplicación continúa totalmente separada del servidor Pediatrics de consultorios y de SICOM: únicamente se comparte el lenguaje visual. Solo existen fixtures inventados en pruebas de GitHub.

## Requisitos verificables

1. Tomar el SHA de `git rev-parse HEAD` en un checkout Git **limpio**. Nunca aceptar SHA pasado por el operador a modo de sustitución del origen.
2. Inspeccionar el directorio real `supabase/migrations`; debe contener **exactamente las once** migraciones aprobadas, sin versiones nuevas o faltantes. Una migración adicional requiere nuevo SPEC y Quality Gate antes de poder incluirse.
3. Generar manifiesto JSON sin credenciales, referencia Supabase, nombres de usuarios o datos de pacientes. Debe incluir versión de contrato, SHA completo del commit, cantidad de migraciones, cantidad de archivos, rutas fijas y SHA-256 de los bytes de cada archivo (once SQL, configuración local y cuatro archivos de la Edge de visitas).
4. Detectar cualquier archivo faltante, distinto, vacío, demasiado grande o enlace simbólico. Rechazar checkout con modificaciones o archivos nuevos no ignorados, y cualquier manifiesto anterior de otro commit. La verificación compara rutas, campos, orden, cuenta, hash y SHA con el checkout actual.
5. `--ci`: prueba estática sin red ni escritura. `--emit`: muestra JSON **no secreto** para guardar fuera del repositorio. `--verify FILE`: coteja manifiesto externo con el checkout actual, sin despliegue ni mutaciones.
6. Incorporar test Node de SHA-256 determinístico, manipulación de hashes, cambios de archivo, número de migraciones, cambio de commit, estructura, orden e invocación de CLI sin red.
7. Añadir `supabase/staging/01d_catalog_readonly_attestation.sql`. Ejecutar **solo tras aplicar once migraciones en staging identificado**; abre una transacción `READ ONLY`, consulta únicamente `pg_catalog` y metadatos de esquema. Comprueba compatibilidad UUID de `auth.users.id`, `auth.sessions.id/user_id`, presencia de `auth.uid()`, las catorce tablas y RLS, permisos efectivos denegados de todos los objetos públicos, RPC de backend y extensión `pgcrypto`. No consulta ninguna fila de `auth.users`, `auth.sessions`, pacientes, historias, visitas o notas.
8. Ejecutar también ese SQL contra PostgreSQL 16 con stub ficticio en GitHub CI **para validar la propia auditoría**, nunca declarar que ello verifica el Auth administrado de Supabase.
9. Agregar pruebas al Quality Gate existente. Mantener los cuatro jobs de Node/privacy, PostgreSQL RLS, Deno Edge y Expo Android/iOS JS. El checkout probado se identifica por SHA de PR y se integra únicamente tras los jobs requeridos.

## Uso seguro en un checkout aprobado

```bash
node scripts/staging-source-attestation.mjs --ci
node scripts/staging-source-attestation.mjs --emit > /tmp/visitas-staging-source.json
node scripts/staging-source-attestation.mjs --verify /tmp/visitas-staging-source.json
```

Guardar ese JSON **fuera del repositorio**, junto al acta operativa del responsable. No confundir el hash SHA-256 con firma digital, aprobación médica ni constancia de instalación en una base. Debe regenerarse ante un nuevo commit o cualquier migración.

Cuando exista un Supabase **nuevo, formalmente aprobado e independientemente verificado**, con once migraciones instaladas en orden, el operador puede ejecutar `supabase/staging/01d_catalog_readonly_attestation.sql` por un canal SQL seguro y **solo con permiso de consulta**. El resultado constante `STAGING01D_CATALOG_READONLY_PASS_NOT_DEPLOYMENT_CERTIFICATE` no acredita que las once migraciones hayan sido aplicadas por un gestor específico ni que se hayan verificado políticas del Dashboard.

## Criterios de aceptación

- CI de PR en GitHub 4/4 con Node y PostgreSQL nuevos incluidos; diff exclusivamente código de preflight, pruebas y docs, sin credenciales.
- No hay red, comandos de Supabase CLI ni cambios SQL persistentes en los nuevos verificadores.
- El manifiesto del **SHA exacto** que finalmente vaya a staging coincide con los bytes del checkout que se usará para desplegar.
- La auditoría SQL reconoce ausencia de Auth administrado, tabla, columna UUID, RLS, función server-only o grants peligrosos, bloqueando con código constante.
- No se declara `STAGING_DEPLOYED`, `STAGING_AUTH_VERIFIED` ni `CLINICAL_GO` en GitHub CI.

## NO-GO y siguientes gates

El proyecto Supabase real no puede presumirse creado por este código. Son condiciones separadas: titularidad, región y tratamiento legal de datos de menores; revisión del equipo de informática y Dirección Médica; almacenamiento privado y permisos Storage; habilitación de profesionales, retención, backups/restauración; configuración Auth, sesiones revocadas, MFA y publicación de Edge; pruebas de aplicación en dispositivos.

**Siguiente paso exacto:** `STAGING-01E` — verificación externa de la identidad y de la titularidad del proyecto Supabase independiente, con operador autorizado, aplicación supervisada de migraciones y ensayo de dos organizaciones ficticias mediante STAGING-01A/B/C. Nunca conectar ni importar pacientes ambulatorios o reales.

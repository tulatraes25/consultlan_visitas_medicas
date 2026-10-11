# STAGING-01E — Historial de migraciones y adopción supervisada de Supabase

**SPEC/Kiro · 2026-10-11 · GitHub-first · proyecto Supabase real aún NO creado ni conectado.**

## Decisión arquitectónica

La internación domiciliaria pediátrica usa un proyecto Supabase **nuevo**, independiente de la clínica ambulatoria Pediatrics/CONSULTLAN y de SICOM. No se importan pacientes, cuentas, agendas, historias clínicas ni credenciales desde esos sistemas. La interfaz puede reutilizar el diseño, pero no los datos.

STAGING-01D ya obtiene hashes SHA-256 de los archivos del commit Git, y valida catálogo con una consulta SQL READ ONLY. Faltaba verificar que el registro de migraciones del **Supabase real** coincida exactamente con las once versiones aprobadas. Este gate prepara la prueba y su ejecución sintética en GitHub; **no instala ni conecta Supabase**.

## Contrato de verificación

1. En un Supabase nuevo, el operador autorizado debe identificar en Dashboard nombre, organización propietaria, región, ref exacta, políticas Auth/Storage y lista de proyectos **excluidos**. Anexar esa evidencia al expediente institucional seguro, no a este repositorio.
2. Antes de la instalación, obtener un checkout limpio del **SHA de `main` con CI PR aprobado**, y producir el manifiesto con `node scripts/staging-source-attestation.mjs --emit` en una ubicación externa. El SHA de Git no implica que el remoto esté desplegado.
3. El operador debe comparar la referencia del Dashboard con el destino enlazado por la CLI. Comandos de inspección oficiales:
   - `supabase link --project-ref <REF_DEL_STAGING_INDEPENDIENTE>`
   - `supabase migration list --linked`
   - `supabase db push --dry-run`

   **No ejecutar `db push` ni `functions deploy` como parte de este gate.** La primera aplicación de migraciones/funciones requiere autorización institucional, respaldo/capacidad de recuperación, inspección del SQL y revisión humana del destino exacto.
4. Después de una aplicación supervisada y aprobada, verificar la historia con `supabase migration list --linked` y, por una conexión SQL segura del operador al proyecto correcto, `supabase/staging/01e_migration_history_readonly.sql`. Consulta solo el campo `version` de `supabase_migrations.schema_migrations`; acepta **exactamente 11** versiones ordenadas, ninguna faltante ni extra. No imprime metadatos del proyecto.
5. También ejecutar `supabase/staging/01d_catalog_readonly_attestation.sql` para comparar estructura Auth, 14 tablas/RLS y grants, sin leer filas clínicas. Ambos scripts son de solo lectura.
6. No confundir historial por **versiones** con cotejo criptográfico de los SQL ejecutados. La tabla de Supabase registra las versiones aplicadas, no necesariamente una huella SHA-256 equivalente a nuestro manifiesto. Se requiere correlacionar simultáneamente: checkout fuente, dry-run revisado, acta de aplicación, historial remoto, catálogo y resultado de las pruebas STAGING-01A/B/C.
7. En GitHub CI, usar exclusivamente el PostgreSQL sintético con un historial creado en `supabase/tests/ci_only_migration_history_stub.sql`. El harness `scripts/ci-staging-history-verify.sh` **rechaza cualquier base que no sea el Postgres descartable de GitHub**, y comprueba éxito con once versiones, fallo con una adicional, fallo con una faltante y fallo con una sustituida.
8. Ningún script de STAGING-01E pide ni almacena tokens, passwords, nombres de pacientes o claves privilegiadas. No subir capturas de credenciales, volcados SQL o evidencias con identificadores reales al repositorio.

## Comandos permitidos en GitHub (SIN nube)

```bash
node scripts/staging-source-attestation.mjs --ci
npm test
# CI aislado de GitHub con PostgreSQL falso, NO contra una base Supabase real:
sh scripts/ci-staging-history-verify.sh
```

El último comando se bloquea fuera del job GitHub con Postgres `visits_synthetic_test`; no es un comando de uso habitual en la PC del operador.

## Requisitos de aceptación

- Quality Gate sobre HEAD exacto: Node, PostgreSQL 16, Deno y Expo Android/iOS JS, 4/4 éxito. El script SQL de historial y la suite negativa se ejecutan **después** del catálogo STAGING-01D.
- El SQL remoto falla cerrado ante `supabase_migrations` ausente, forma inesperada de `version`, 0 versiones, 10 versiones, 12 versiones o una versión distinta. No modifica historial ni esquema.
- El número y el orden de las once versiones del SQL coinciden con `REQUIRED_MIGRATIONS` en `src/operations/staging-policy.mjs`; la prueba Node falla si divergen.
- El operador conserva una evidencia de destino separada del manifiesto Git, sin secretos en GitHub. Nunca certificar infraestructura desde una declaración autoafirmada.
- La verificación real contra Supabase alojado permanece expresamente pendiente hasta que exista staging y autorización.

## NO-GO y alcance futuro

Aun si el historial remoto, el catálogo, los probes de Auth/sesión y el aislamiento pasan, continúa prohibido admitir pacientes reales hasta verificar identidad/representación de menores, habilitación profesional, protocolos clínicos, aprobación de Dirección Médica, privacidad, retención, Backups y **prueba de restauración**, monitoreo y operación segura.

**Siguiente gate exacto:** `STAGING-01F`: ejecutar con operador aprobado el protocolo read-only + Auth de dos organizaciones ficticias y registrar su resultado sin secretos. En paralelo pueden desarrollarse pantallas y contratos móviles totalmente sintéticos.

Referencias oficiales: [Supabase CLI workflow](https://supabase.com/docs/guides/local-development/cli-workflows), [Supabase migration list](https://supabase.com/docs/reference/cli/supabase-migration-list) y [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations).

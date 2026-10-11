# SEC-SURFACE-01 — Protección automática ante futuras migraciones con permisos inseguros

**SPEC/Kiro · 2026-10-10 · auditoría de catálogo exclusivamente en PostgreSQL sintético GitHub.**

## Hallazgo y motivación
SEC-READ-02B cierra lectura directa del conjunto **actual** de catorce tablas. Pero una migración futura podría crear una tabla, vista, secuencia o RPC `SECURITY DEFINER` y otorgar permisos implícitos o explícitos a `authenticated`, `anon` o `PUBLIC`. Un inventario estático de 14 nombres no descubriría automáticamente esa regresión.

## Objetivo
Incorporar al Quality Gate un control que recorra el catálogo real de PostgreSQL tras aplicar **todas** las migraciones y bloquee nuevas rutas públicas de lectura o ejecución que eviten la Edge con Auth y sesión viva.

## Requisitos y diseño
1. `supabase/tests/dynamic_public_surface_guard.sql` enumera automáticamente cada relación del esquema `public` (`relkind` tabla, partición, vista, vista materializada y tabla extranjera). Para todas niega, a `anon` y `authenticated`, `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` y `TRIGGER`. Las concesiones heredadas de `PUBLIC` cuentan como permisos efectivos y deben fallar.
2. Las secuencias del esquema `public` deben denegar a esos roles `USAGE`, `SELECT` y `UPDATE`, incluidos nuevos objetos creados por migraciones posteriores.
3. Enumera funciones `api_*` y todas las funciones `SECURITY DEFINER` del esquema `public`. Cualquier EXECUTE disponible para `anon` o `authenticated` falla. Los definer deben fijar `search_path=''` explícito. Las funciones ordinarias de `pgcrypto` no son APIs clínicas y quedan fuera de este grupo.
4. Mantener explícitos los contratos server-only `api_hc_episode_scope`, `api_hc_list_my_coverages` y `api_is_live_session` como ejecutables por `service_role`, sin reabrir las antiguas RPC clínicas de SUPA-04.
5. No modificar tablas ni roles, no crear un proyecto Supabase ni usar registros reales. Esta verificación ocurre **después** de las once migraciones y pruebas anteriores, dentro del PostgreSQL 16 de GitHub.
6. El gate falla de forma segura si el catálogo no conserva el mínimo de tablas/RPC esperadas; no vale una base vacía para declarar PASS.

## Aceptación
Quality Gate PR exitoso en HEAD exacto: PostgreSQL 16, tests Edge Deno, políticas Node y Expo TypeScript/Jest/export Android/iOS. Auditar diff de CI/test/doc, merge normal y verificación posterior de `main` cuando el conector lo permita.

## Límites y siguientes pasos
Este control verifica **grants de catálogo**, no reemplaza RLS de políticas internas, controles de `auth.sessions` en un Supabase real, configuración de API expuesta, cuotas, filtrado de endpoints, Storage, backups, consentimiento ni habilitación asistencial. Si una futura tabla o función necesita acceso público legítimo, exige SPEC independiente con justificación y rediseño del control — no agregar excepciones silenciosas.

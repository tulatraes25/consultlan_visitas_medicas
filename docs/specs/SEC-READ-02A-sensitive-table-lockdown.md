# SEC-READ-02A — Cierre de lectura JWT directa de tablas sensibles

**SPEC/Kiro · candidato exclusivamente GitHub/CI sintética, 2026-10-10.**
Sin proyecto Supabase real, sin pacientes, sin despliegue y sin autorización clínica.

## Hallazgo
Las migraciones históricas concedieron `SELECT` a `authenticated` para que políticas RLS limitaran las lecturas directas de PostgREST. Aunque RLS controla organización y rol, **no comprueba de manera centralizada la presencia actual de la sesión en `auth.sessions`**. Un JWT válidamente firmado puede permanecer activo hasta su vencimiento después de cerrar sesión; el gate extra de la Edge no se aplica a un GET directo.

HC-READ-01 revocó SELECT directo sobre `homecare_coverage_assignments` y `homecare_shift_handovers`, y autorizó únicamente la lectura de una agenda propia vía Edge. Persistían once tablas accesibles directamente mediante JWT.

## Decisión de diseño
1. Revocar `SELECT` de `public`, `anon` y `authenticated` en: `organizations`, `memberships`, `professionals`, `patients`, `visits`, `clinical_records`, `attendance_evidence`, `audit_events`, `homecare_care_team`, `homecare_care_plan_versions` y `homecare_plan_review_requests`. Junto con HC-READ-01 quedan **trece tablas** sin lectura directa por JWT.
2. Conservar las políticas RLS ya definidas y los privilegios de las funciones `SECURITY DEFINER` de backend. No modificar el esquema clínico, no otorgar privilegios nuevos y no eliminar restricciones de integridad.
3. Excepción **temporal y bloqueante**: mantener `SELECT` a `authenticated` sobre `homecare_episodes` **solo** para que el verificador STAGING-01B pueda demostrar con dos organizaciones ficticias una lectura no vacía propia y una lectura cruzada vacía. `anon` continúa sin SELECT. RLS debe permanecer habilitado.
4. Esta excepción debe desaparecer en **SEC-READ-02B**, después de preparar un sustituto seguro del verificador remoto que pruebe RLS sin crear una vía de acceso clínico no verificada por sesión activa.
5. No crear lecturas de pacientes, notas, planes, consentimientos, medicaciones ni responsables hasta establecer endpoints Edge mínimos por propósito y roles aprobados; un cliente no recibe `service_role`.

## Implementación y verificación
- Migración `20261010090000_close_direct_sensitive_reads.sql`: revocación de once SELECT, sin cambios de filas.
- `supabase/tests/close_direct_sensitive_reads.sql`: comprueba en PostgreSQL 16 los trece permisos denegados para `authenticated`/`anon`, RLS habilitado, rechazo real a SELECT de pacientes/notas/equipo/revisiones, excepción `homecare_episodes` y continuidad de RPC exclusiva del servidor.
- Actualización de CI y `REQUIRED_MIGRATIONS` a diez, con prueba de presencia sin red.
- Documentación del bloqueo institucional y de staging.

## Criterios de aceptación
El SQL y la suite RLS se ejecutan exitosamente en PostgreSQL sintético, así como Deno Auth/Edge, Node privacy/contracts, Expo TypeScript/Jest y export JS Android/iOS. Se comprueban archivos/diff y SHA exacto en GitHub antes del PR/merge, más CI posterior al merge cuando el conector pueda recuperarla.

## Resolución posterior — SEC-READ-02B

SEC-READ-02B sustituye STAGING-01B por una prueba de alcance vía Edge y revoca la excepción final de `homecare_episodes`. El texto siguiente describe los riesgos del estado **intermedio** SEC-READ-02A, no el estado después de aplicar la undécima migración. La validación efectiva de Supabase alojado sigue pendiente. [SPEC SEC-READ-02B](SEC-READ-02B-episode-edge-gate.md).

## Riesgos y NO-GO
**La excepción de episodios mantiene el riesgo de un JWT no vencido pero con sesión revocada, aunque RLS siga aislando organización y equipo.** No se permite presentar SEC-READ-02A como cierre total de exposición de información sanitaria. El next gate **SEC-READ-02B** debe resolver el test remoto STAGING-01B sin lectura directa de episodios y entonces revocar también esa última tabla.

Además siguen pendientes STAGING-01A/B/C reales, semántica administrada de Auth, titularidad y residencia de datos, contratos, retención, backups/restauración, Storage privado, validación de profesionales y aprobación de Dirección Médica. El código de GitHub no es un sistema asistencial habilitado.

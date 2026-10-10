# Supabase independiente — GATE SUPA-01

**Estado:** migración y controles RLS en GitHub, sin instalación en cuenta Supabase real.
**Decisión:** [ADR-002](../docs/adr/ADR-002-supabase-autonomo.md). **Prohibida** la conexión con el servidor de Pediatrics/CONSULTLAN.

## Modelo inicial
La migración `migrations/20261010000000_standalone_foundation.sql` crea:
- `organizations` y `memberships`: acceso propio con perfiles ADMIN, COORDINATOR, PROFESSIONAL, AUDITOR.
- `professionals`: profesional activo asociado a `auth.users.id` de **este** Supabase.
- `patients`: directorio propio, sin identificadores importados.
- `visits`: visitas asignadas, identificadores UUID, pertenencia de paciente/profesional a misma organización y estados permitidos.
- `clinical_records`: notas separadas, legibles solo por profesional activo asignado.
- `attendance_evidence`: metadatos de conformidad (no imagen cruda ni firma digital).
- `audit_events`: eventos para ADMIN/AUDITOR, sin narrativas clínicas.

Los roles funcionales se guardan en la base (membership); el cliente nunca puede editarlos ni atribuirse privilegios a partir de `user_metadata`. Los nombres de especialidades no elevan permisos.

**Todas las tablas tienen RLS habilitado. Solo se concede SELECT restringido a `authenticated`; NO se concede INSERT/UPDATE/DELETE desde dispositivos.** Para altas de usuarios, agenda, asignaciones y evolución clínica se implementarán funciones futuras con autorización y auditoría transaccional. La autorización externa de usuario debe construirse en el servidor, no a partir del payload móvil.

## Prueba local sin Supabase
En GitHub CI se inicia un servicio `postgres:16-alpine` sin datos externos:
```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/postgres_auth_stub.sql
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261010000000_standalone_foundation.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql
```
El stub `postgres_auth_stub.sql` simula exclusivamente el esquema de autenticación y roles de Supabase dentro del Postgres de CI. **No debe ejecutarse en Supabase real.**

Se prueban usuarios asignados y no asignados, aislamiento entre organizaciones, lectura administrativa sin notas clínicas, auditoría separada, usuarios inactivos, usuarios anónimos, mutaciones directas rechazadas, integridad referencial y revocación de membresía.

## Puesta en marcha posterior (NO realizada)
1. La administración propietaria de Pediatrics crea un **proyecto Supabase nuevo y separado**, comprueba responsabilidad contractual, región de residencia de datos, privacidad, backup/restore y política de retención. Nunca usar el proyecto SICOM ni un entorno de CONSULTLAN.
2. Configura Supabase Auth con registro abierto/usuarios anónimos deshabilitados; define invitaciones, MFA, rotación, recuperación y control de sesiones. **No** desplegar con pacientes reales sin una revisión de cumplimiento sanitario/contractual.
3. Aplica migraciones versionadas sobre un entorno **staging vacío** mediante un mecanismo autenticado del equipo; revisa grants, RLS, esquema `private` no expuesto, funciones SECURITY DEFINER y acceso a tablas.
4. Ejecuta `supabase test db` y pruebas de acceso desde clientes externos contra staging con cuentas ficticias (aun pendientes) antes de producción; una prueba en Postgres puro **no sustituye** la evaluación integral de Supabase.
5. Solo una vez auditada la seguridad, crear funciones Edge para alta de usuarios/pacientes, agenda y registros, usando privilegios server-side y mecanismos de auditoría.
6. Diseñar Storage **privado** con políticas de objetos y retención antes de incorporar PDFs, firmas o cualquier adjunto. No crear buckets públicos de documentos clínicos.
7. Solo con autorizaciones válidas y aprobaciones legales, integrar las firmas electrónicas y la firma digital del profesional por proveedor/certificador autorizado.

## Variables de la app (futuro)
La app podrá recibir URL del **Supabase propio** y su clave **publicable**, más el JWT de la sesión autenticada. La clave `service_role` y secretos de firma **nunca** pueden estar en el bundle móvil, secretos públicos del build ni repositorios.
No se configura ninguna URL real en este gate. La demo sigue ejecutándose 100% con datos sintéticos en memoria.

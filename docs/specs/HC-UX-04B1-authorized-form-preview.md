# HC-UX-04B1 — Resolver la planilla desde una cobertura propia y autorizada

**SPEC/Kiro · 2026-10-11 · issue #60 · GITHUB-SYNTHETIC-ONLY**

## Problema y prioridad UX

La pantalla de demostración ya abre en un toque la planilla de una prestación ficticia (HC-UX-04A). Pero el cliente nunca debe decidir qué especialidad, episodio u organización puede atender: `App.tsx` todavía es una simulación sin usuario autenticado y con coberturas de distintos profesionales ficticios. La base SQL almacena `professionals.specialty` como texto, sin un contrato servidor para derivar una de las seis constancias aprobables del inventario HC-03A.

Objetivo: **establecer en SQL y Edge el único mecanismo futuro para saber qué planilla estructural mostrar**, sin leer datos clínicos ni asumir que planillas/documentos están habilitados.

## Diseño mínimo y decisiones

1. **RPC exclusiva del backend:** `public.api_hc_resolve_my_attendance_template(p_actor uuid,p_coverage uuid)`. Ningún parámetro de organización, episodio, paciente, profesional, fecha, rol, especialidad o plantilla elegido por el móvil.
2. **Autorizar siempre en SQL, no confiar en RLS con service_role:** exigir cobertura de `p_actor` vinculada a profesional y membresía activos con rol `PROFESSIONAL`, organización activa, equipo del episodio activo/sin término, episodio `ACTIVE`, plan `APPROVED` con metadata de aprobación presente y período de validez que abarque la cobertura, estado `ASSIGNED` o `ACTIVE` y plan/episodio/paciente/org coincidentes por FK.
3. **Mapeo de fuente fijo:** Medicina → `MEDICAL_ATTENDANCE`; Enfermería/Cuidadoras → `NURSING_CAREGIVER_ATTENDANCE`; Kinesiología → `PHYSIOTHERAPY_ATTENDANCE`; Fonoaudiología → `SPEECH_ATTENDANCE`; Terapia ocupacional → `OCCUPATIONAL_THERAPY_ATTENDANCE`; Nutrición → `NUTRITION_ATTENDANCE`. Alias de denominación explícitos, **sin heurística**. Para `SHIFT` solo se permite en esta fase Enfermería/Cuidadoras: los demás profesionales no se sustituyen por una visita genérica ni reciben hoja arbitraria.
4. **Salida estricta `{templateId,mode:"READ_ONLY_STRUCTURE_PREVIEW"}`:** no incluir coverage/patient/org/professional/episode IDs, domicilio, estado de firma, evolución, diagnósticos, tratamiento, conformidad ni documento. Igual denegación SQLSTATE `42501` para profesional ajeno, sin especialidad mapeable, caso suspendido, plan no habilitado, organización ajena, cobertura cancelada o desconocida: no revelar existencia.
5. **Edge tras Auth y sesión viva:** acción `resolveMyHomecareAttendanceTemplate` recibe únicamente `coverageId` UUID y la autorización del usuario; el actor `p_actor` llega del verificador Auth+live session preexistente. La Edge revalida **dos claves y seis valores permitidos** y rechaza resultados ampliados como error genérico. Si el backend agrega una columna clínica por error, no se transmite.
6. **Sin edición de datos reales:** no agregar nuevos SELECT/JWT grants, tablas, contratos de firma ni mutaciones. No conectar ni montar un cliente clínico móvil; este subgate prepara el contrato de backend, no prueba Supabase real ni aprobación médica.
7. **Migrations con procedencia exacta:** incorporar versión `20261011110000` como migración 13; actualizar `REQUIRED_MIGRATIONS`, fingerprints, pruebas del manifiesto, historial readonly remoto y stub de CI, de modo que el inventario de staging siga fail-closed ante cambios inesperados.

## Pruebas obligatorias

- SQL PostgreSQL 16 desechable: 6 profesiones (más Enfermería/Cuidadoras), VISIT/SHIFT, rechazo de shift no enfermero, pertenencia propia, otra organización, roles no profesionales, equipo/profesional/membresía/organización revocados, episodios suspendidos, plan draft/caducado, cobertura cancelada o completada, actor/cobertura nulos o no existentes. Toda mutación de fixture queda en transacción con `ROLLBACK`.
- Deno Handler: action+coverage UUID exactos, `p_actor` inyectado tras Auth, denegación JWT, prohibición de `organizationId`/`professionalId`/`patientId`/`templateId`/`specialty`, salida sin exceso de campos ni PHI, manejo de errores seguro.
- GitHub Quality Gate: conservar cinco jobs, sumar migración y test antes de prueba dinámica de grants, mantener control del historial exacto 13/13 y fingerprint por commit, comprobar bundle Android/iOS y navegador.

## Límites y aceptación

`APPROVED` en los planes creados por fixtures de PG16 **es un estado sintético de prueba**, no prueba autorización médica firmada. La función no habilita altas, aprobaciones, historias clínicas, capturas, firmas, constancias ni PDFs. Supabase real de internación domiciliaria **no fue creado/desplegado/probado** aquí. La exigencia de cotejar archivos DOCX/PDF originales en privado (issue #57) y las decisiones de firma/obra social/foliado sigue vigente.

**Cierre de este subgate:** PR 5/5, merge normal, CI posterior de `main` 5/5, SHA exacto. **No cerrar el issue padre #60**: HC-UX-04B2 deberá implementar un adaptador móvil de solo lectura con limpieza ante logout/revocación, snapshot de sesión, descarte de respuestas tardías y prueba sobre *staging* independiente sintético antes de conectar una pantalla operativa.

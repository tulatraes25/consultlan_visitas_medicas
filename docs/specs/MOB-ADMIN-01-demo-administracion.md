# MOB-ADMIN-01 — UX de coordinación móvil autónoma

**Estado histórico:** interfaz original de demostración en memoria; UI/CI ya certificados en MOB-ADMIN-01. **Horarios fijos y validación por igualdad fueron sustituidos por MOB-ROSTER-02**. Sin backend real.

## Objetivo
Diseñar la gestión de pacientes y profesionales de internación domiciliaria de Pediatrics, **sin reutilizar registros ni usuarios del servidor CONSULTLAN**. Antes de poner un paciente real, verificar con SUPA-02/03 en staging (no incluido ahora).

## Navegación
Una tercera pestaña **Gestión** (celular y tablet) ofrece:
- **Pacientes:** alta de identificador de muestra de hasta 4 letras/números; etiqueta generada `Paciente ficticio X`.
- **Profesionales:** identificador corto y especialidad (medicina, enfermería, kinesiología, fonoaudiología, terapia ocupacional, nutrición). No invita ni genera usuarios en Supabase Auth.
- **Asignaciones (diseño original obsoleto):** seleccionar paciente/profesional y horario fijo. La interfaz vigente selecciona tipo VISIT/SHIFT, fecha y horarios variables; ver [MOB-ROSTER-02](MOB-ROSTER-02-flexible-coverage.md).

## Invariantes de demo
1. Solo `useState` en React Native. Sin Supabase, API, Storage, fotos, domicilios, DNI, historia clínica, firmas reales, invitaciones ni persistencia.
2. No se admite la introducción de nombres completos: los campos usan únicamente códigos ficticios cortos.
3. El profesional y el paciente se crean en listas sintéticas; no se confunden sus roles.
4. El nuevo turno aparece en la agenda de muestra. La implementación vigente **rechaza intervalos superpuestos** del profesional, incluso entre VISIT/SHIFT y medianoche. La autoridad real sigue siendo PostgreSQL/RLS en Supabase independiente.
5. Cuando el usuario cambia de pestaña, las entidades creadas siguen en memoria; desaparecen cuando reinicia la aplicación.
6. La pantalla Gestión **NO** afirma proteger permisos: en producción debe quedar detrás de Auth y de roles `ADMIN`/`COORDINATOR` confirmados en Supabase.
7. El prototipo de firma continúa separado y no permite certificar prestaciones reales.

## Criterios de aceptación
- React Native TypeScript estricto y bundles JS Android/iOS exportados en CI.
- UI tests de paciente nuevo/repetido, profesional/especialidad, selección/asignación, prevención de duplicados y navegación teléfono/tablet.
- Pruebas SUPA-01/SUPA-02 PostgreSQL y SUPA-03 Deno siguen verdes.
- Aislamiento total del servidor original Pediatrics/CONSULTLAN; repositorio sin datos clínicos reales.
- GitHub PR, merge normal y post-main Quality Gate.

## Evolución posterior
La estructura documental se incorporó con **HC-03A y HC-03B** (solo previsualización), y la agenda flexible se documenta en **MOB-ROSTER-02**. El próximo bloqueo asistencial es **HC-02C** para autorización clínica y profesionales, antes de HC-03C (evidencias y firmas).

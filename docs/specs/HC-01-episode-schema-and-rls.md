# HC-01 — Modelo relacional de internación domiciliaria pediátrica

**SPEC/Kiro · Estado:** candidato GitHub-first para certificación (2026-10-10). No despliegue Supabase; ningún paciente identificable en el código.

## Decisión / Contexto

Los pacientes atendidos por el programa de internación domiciliaria **no son los del consultorio de Pediatrics**. El sistema utiliza identidad, base y registros propios en un proyecto Supabase separado; CONSULTLAN solo aporta la identidad visual.

El modelo previo centrado en `visits` era insuficiente para niños con patologías complejas y atención longitudinal. El objeto principal es `homecare_episodes`. Una visita es una actividad subordinada a un episodio, y un profesional accede solo a los episodios donde participa.

## Implementación / Diseño

`supabase/migrations/20261010020000_homecare_episodes.sql` (depende de SUPA-01/02):

| Entidad | Contenido V1 acotado | Restricción |
|---|---|---|
| `homecare_episodes` | organización, paciente local, estados DRAFT/ACTIVE/SUSPENDED/DISCHARGED, fechas, profesional referente opcional | FK compuesta impide episodio con paciente de otra organización; activación/egreso requieren fecha |
| `homecare_care_team` | episodio, organización, profesional, función LEAD/CARE_TEAM, activo | FK impide mezclar organizaciones y profesionales |
| `homecare_care_plan_versions` | episodio, número de versión, estado DRAFT/APPROVED/SUPERSEDED y metadatos de aprobación | FKs, una sola versión APPROVED por episodio, sin narrativa, órdenes ni dosis |
| `visits` (anterior) | agrega `homecare_episode_id` y `care_plan_version` | FKs impiden usar un episodio de otro paciente, y nueva actividad exige episodio + versión |

**Estado transicional intencional:** Las filas del prototipo anterior permanecen sin episodio (NULL). Se aplica `CHECK ... NOT VALID`: las filas existentes NO se convierten artificialmente en episodios clínicos ni son visibles por las políticas nuevas, pero **se rechazan todas las filas nuevas y toda actualización sin episodio/versión**. No interpretar `NOT VALID` como excepción para nuevas inserciones. Si en futuro existieran visitas reales antiguas, se requeriría una migración aprobada clínicamente, sin backfill automático.

**Activación de visitas:** un trigger comprobado por PostgreSQL exige episodio ACTIVE, plan APPROVED correspondiente, período de vigencia y profesional integrante del equipo con membresía activa. La aprobación de planes en este gate es SOLO metadato estructural de prueba; no existe aprobación clínica digital funcional.

## Seguridad

- RLS en todas las nuevas tablas, con **solo SELECT por miembro activo del equipo** o ADMIN/COORDINATOR para metadatos operativos. AUDITOR y otros profesionales no reciben datos clínicos.
- La narrativa clínica de `clinical_records` **continúa restringida al profesional asignado a esa visita**. No se abren todas las notas al equipo por el hecho de participar en el episodio.
- Los registros de paciente y evolución correspondientes a visitas antiguas sin episodio dejan de ser accesibles en la aplicación.
- Ni `anon` ni `authenticated` obtienen INSERT/UPDATE/DELETE sobre episodios, equipo o planes. El rol `service_role` solo recibe SELECT de estos nuevos objetos, hasta implementar las operaciones auditadas de HC-02.
- No hay cruce con historias/identificadores de la clínica Pediatrics.
- El RPC legado `api_schedule_visit` de SUPA-02 todavía no recibe `homecare_episode_id`: **fallará cerrado** cuando se aplique HC-01. NO considerarlo una función de agendamiento operativo. HC-02 la sustituirá por un circuito seguro de episodio, plan y cobertura.
- No se habilita inicio de atención real, firma válida, prescripción, expediente médico ni monitoreo de emergencias.

## Criterios de aceptación / Tests

La CI de GitHub debe ejecutar el orden exacto:
1. SQL `postgres_auth_stub.sql` y migración SUPA-01 con prueba de RLS.
2. Migración SUPA-02 y pruebas de operaciones existentes.
3. Migración HC-01 y `homecare_episode_isolation.sql` en PostgreSQL 16 real.
4. Pruebas existentes de dominio, Deno Edge, TypeScript/UI y exportación JS Android/iOS.

**Casos obligatorios:** separación entre pacientes y episodios, FK entre organizaciones y profesionales, plan ausente/borrador, profesional fuera de equipo, permisos de coordinador vs clínicos, otras organizaciones, usuario revocado, usuarios anónimos, rechazo de escrituras móviles, rechazo de nuevas visitas no vinculadas y bloqueo del RPC antiguo.

### Exclusiones por falta de criterio clínico aprobado

No se especifican medicamentos, posología, alertas clínicas, autorizaciones de personas menores, ni emergencias. El Kardex, signos vitales, procedimientos y hoja de crisis **siguen en el domicilio** de acuerdo con la documentación provista. No hay importación de datos de consultorios.

## Riesgo / Siguiente gate

**HC-02:** crear comandos transaccionales de admisión, asignación de equipo, aprobación segura y versionada del plan por personal clínico habilitado, y programación de coberturas prolongadas y visitas puntuales, con permisos y pruebas negativas. El módulo actual de gestión móvil sigue ficticio, y la app todavía no se conecta con Supabase.

**Condición de cierre:** PR CI verde, diff acotado, merge normal y post-main CI verde en el SHA exacto. Las pruebas PostgreSQL locales de GitHub no certifican un proyecto Supabase real.

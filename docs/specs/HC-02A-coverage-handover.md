# HC-02A — Agenda única de coberturas domiciliarias y relevos

**Estado:** implementación estructural GitHub-first con datos sintéticos; no hay Supabase desplegado ni pacientes importados de consultorios.
**Parte del programa:** internación domiciliaria pediátrica autónoma, distinto del sistema de consultas Pediatrics.

## Objetivos

1. Representar una **visita puntual** y una **guardia/cobertura prolongada** sin convertir ambas en turnos rígidos de 40 minutos.
2. Impedir solapamientos de asignaciones para un mismo profesional, independientemente de si trabaja en guardia o visita; intervalos con fin exclusivo `[inicio,fin)`.
3. Relacionar cada asignación con episodio propio, paciente, equipo y plan autorizado.
4. Modelar el **relevo entre guardias** con receptor y estado auditables, sin fingir una comunicación médica, una firma o una emergencia atendida.
5. Bloquear el acceso a agenda ajena, escritura desde móviles y reutilización del modelo antiguo de visitas.

## Implementación

`supabase/migrations/20261010030000_homecare_coverage.sql`:

- `homecare_coverage_assignments`: agenda/roster unificada, `service_kind=VISIT|SHIFT`, UUID de episodio y paciente, profesional, versión del plan, inicio/fin, estado y auditoría básica. Evita doble asignación mediante exclusión GiST PostgreSQL del profesional **entre ambos tipos de servicio**.
- `homecare_shift_handovers`: enlaza dos asignaciones de tipo SHIFT en el mismo episodio. Admite PENDING/ACKNOWLEDGED/DECLINED, timestamp de recepción y receptor auténtico vinculado al profesional entrante. **No almacena contenido de atención, medicamentos ni respuesta a emergencias**.
- `visits.homecare_coverage_id`: vínculo con asignación de tipo VISIT que coincide exactamente con organización, paciente, episodio, profesional, plan, período y estado compatible. Una cobertura puntual no puede originar dos filas de visita.
- `CHECK NOT VALID` preserva los fixtures históricos sin inventar cobertura; todas las nuevas visitas requieren `homecare_coverage_id` y las antiguas quedan fuera del RLS.
- RLS de cobertura: COORDINATOR/ADMIN ven programación de su organización, profesionales solo sus propias asignaciones y sus relevos entrantes/salientes si siguen en el equipo activo. El auditor no accede a registros de pacientes ni cobertura.
- RLS de narrativa: sigue limitada al profesional asignado a la nueva visita canónica, **no** se comparte con todos los miembros del episodio.
- Solo SELECT desde cuentas autenticadas, SELECT de backend privilegiado; **ningún rol móvil ni `service_role` puede escribir directamente** estas tablas hasta HC-02B.

## Invariantes / pruebas negativas

- No existe un tipo de visita que derive automáticamente de un turno del consultorio.
- El plan DRAFT no autoriza asignación; una asignación debe estar dentro de un episodio ACTIVE y un plan APPROVED válido, y corresponder a profesional del equipo activo.
- Una guardia y una visita del mismo profesional **no se superponen en el roster unificado**, aunque pertenezcan a episodios diferentes.
- Un relevo jamás une episodios diferentes, visitas convencionales o perfiles no participantes. ACKNOWLEDGED requiere que coincida el usuario del profesional entrante; esto **no autentica por sí solo** una comunicación: el RPC futuro verificará la sesión.
- Un profesional no lee las notas de otro por el mero hecho de participar en su episodio.
- Los antiguos registros `visits` sin cobertura quedan ocultos, sin backfill automático. Cualquier implementación previa de agenda se considera bloqueada hasta completar HC-02B.
- Los casos, nombres, franjas y documentos de GitHub son ficticios; no se han incorporado diagnósticos, escalas de riesgo ni instrucciones terapéuticas.

## Riesgos pendientes y siguiente gate

- **HC-02B**: operaciones transaccionales auditadas de admisión, plan, equipo, asignación/recambio de guardias y visitas, validando que la autorización clínica procede de un profesional habilitado; no se permiten órdenes automáticas.
- Aún falta la conciliación `VISIT` vs `SHIFT` para efectores y obras sociales, las excepciones por relevo, cobertura incompleta y las responsabilidades contractuales aprobadas por Pediatrics.
- Se requieren definición clínica de relevos/guardias y UAT en dispositivos; pruebas de PostgreSQL no prueban continuidad asistencial real.
- Sin credenciales Supabase de producción, documentos de pacientes ni firma digital habilitada.

## Criterio de certificación

GitHub CI aplica SUPA-01/02 → HC-01 → HC-02A y pruebas negativas con PostgreSQL 16, conserva Deno Edge, tests de dominio, React Native y export de JS Android/iOS. PR y post-main en commit exacto deben aprobar.

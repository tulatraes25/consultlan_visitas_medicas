# MOB-TIME-01 — Zona horaria explícita para agenda de prueba

**SPEC/Kiro · 2026-10-11 · no desplegado · exclusivamente datos sintéticos.**

## Hallazgo y riesgo

La pantalla desconectada `StagingOwnRosterPreview` mostraba horas ISO como `2026-10-15T20:00:00Z`. Una profesional de internación domiciliaria puede interpretarlas como hora civil de visita, en vez del instante UTC, adelantando o retrasando una guardia; los relevos nocturnos agregan riesgo de error de día. Cambios de horario estacional pueden repetir la misma hora civil con **dos offsets distintos**.

## Objetivo y requisitos

1. La pantalla de lectura mínima de staging exige que el integrador provea **zona IANA explícita del servicio** (`serviceTimeZone`), por ejemplo `America/Argentina/Buenos_Aires`. La app no la deduce del teléfono, usuario, cuenta de CONSULTLAN, ni de una dirección de paciente. El identificador de zona debe validarse con `Intl`.
2. Con zona inválida o soporte de zona/offset insuficiente en el dispositivo: impedir consulta desde la pantalla y **no mostrar ninguna cobertura** previamente cargada. No hacer fallback silencioso a UTC ni usar zona del dispositivo.
3. Convertir cada instante validado por MOB-DATA-03 a **fecha y hora civil** de esa zona; incluir junto a **cada inicio y fin** el offset explícito (`GMT-3`, `GMT-4`, etc.), para distinguir días y horas repetidos en transiciones DST.
4. Mantener íntegros los instantes originales del backend, los seis campos de Edge y su filtrado por sesión viva. Este cambio es de **presentación**, no define citas, autorización, solapamientos o firma.
5. Sin credenciales, Supabase real, datos clínicos, escritura, almacenamiento, ubicación del domicilio ni modificaciones SQL. No integrar la pantalla con `App.tsx`.
6. Regresión automatizada: zona argentina UTC-03, cruce de medianoche, hora duplicada en Nueva York durante DST, zona inválida, botón de consulta bloqueado, ocultación inmediata y render RN. Conservar Quality Gate Node, PostgreSQL 16 RLS, Edge Deno, Expo TypeScript/Jest y exportación Android/iOS.

## Implementación

- `apps/mobile/src/coverageServiceTime.ts`: validación de zona IANA y formateo de instantes con offset por registro.
- `apps/mobile/src/StagingOwnRosterPreview.tsx`: hora operativa explícita y bloqueo de consulta/visibilidad sin zona válida.
- Tests: `CoverageSessionController.test.tsx` y `CoverageAuthEvents.test.tsx` actualizados.

## Verificación y criterio de aceptación

Un instante `2026-10-15T20:00:00Z` se ve a las `17:00 GMT-3` bajo `America/Argentina/Buenos_Aires`; `2026-10-16T08:00:00Z` se ve a las `05:00 GMT-3` del día siguiente. En `America/New_York`, `2026-11-01T05:30:00Z` y `2026-11-01T06:30:00Z` muestran ambas 01:30, pero con offsets GMT-4 y GMT-5 respectivamente.

## NO-GO

No existe un origen institucional autorizado que determine aún la zona horaria real de los episodios. **No** asumir que zona de prueba es contractual para todos los pacientes o provincias. Antes de conectar Supabase, Coordinación debe definir timezone institucional y políticas de horarios/feriados/relevos; STAGING-01F-REMOTE y habilitación clínica siguen bloqueados.

**Siguiente gate autónomo:** auditar las reglas de ordenamiento de coberturas por instante y la indicación de continuidad cuando la respuesta Edge supere cien registros, sin declarar agendas completas con datos parciales.

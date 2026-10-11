# MOB-DATA-03 — Integridad temporal y unicidad de coberturas mínimas

**SPEC/Kiro · 2026-10-11 · React Native / Expo, staging exclusivamente sintético.**

## Hallazgo

El contrato de lectura por Edge ya impone seis campos por cobertura y un máximo de cien registros. Pero el lector admitía IDs duplicados e interpretaba las fechas únicamente con `Date.parse`: ciertos motores JavaScript normalizan `2026-02-30` a un día de marzo en lugar de rechazarlo.

En atención domiciliaria esto puede deformar la secuencia de visitas o generar tarjetas duplicadas. Se corrige en el cliente **sin asignarle autoridad sobre el plan médico ni reemplazar las restricciones SQL**.

## Requisitos

1. Conservar el esquema exacto de respuesta `id, episode_id, service_kind, coverage_state, scheduled_start, scheduled_end` y el límite de 100 filas. Prohibir datos libres, pacientes, identificaciones, firmas, domicilios, prescripciones y columnas clínicas nuevas.
2. Cada UUID de cobertura debe aparecer **una sola vez** en toda la respuesta, sin importar mayúsculas/minúsculas. Dos versiones del mismo ID producen fallo atómico con código fijo `ROSTER_DUPLICATE_COVERAGE_ID`. Nunca deduplicar silenciosamente ni mostrar una lista parcial.
3. Validar estrictamente formato de fecha ISO 8601 con zona horaria, calendario gregoriano y día real del mes (incluidos años bisiestos con reglas de siglos). Rechazar día/mes cero, 31 de abril, 29/30 de febrero inexistentes, hora 24, minuto/segundo 60, offset fuera de ±14:00, zona omitida y fracciones de segundo excesivas.
4. Aceptar ISO válido con `Z` y offsets explícitos (incluyendo `-03:00` y `+05:45`); seguir exigiendo tiempo de fin estrictamente posterior al inicio. Mantener las cadenas originales de los horarios tal como se recibieron. **No calcular períodos clínicamente autorizados en el móvil**.
5. Propagar errores de forma segura al controlador MOB-DATA-02: nunca publicar la agenda previa tras un fallo. No imprimir servidor, JWT o identificadores en logs; no crear rutas, SQL o migraciones.
6. Ajustar el test de 100 filas para emplear 100 UUID **únicos**; el test previo repetía artificialmente el mismo UUID cien veces, condición que ahora debe ser rechazada.

## Verificación

- `apps/mobile/src/readonlyCoverageClient.ts`: función interna de calendario y zona; detección de IDs duplicados.
- `apps/mobile/src/coverageSessionController.ts`: error seguro de ID duplicado.
- `apps/mobile/__tests__/readonlyCoverageClient.test.ts`: fechas imposibles, offsets, bisiestos, IDs duplicados equivalentes y exactamente 100 filas distintas.
- CI GitHub 4/4 sobre SHA exacto, incluyendo pruebas RN y exportación JS Android/iOS.

## NO-GO

El adaptador sigue **desconectado de App**. El control de datos no sustituye la autenticación de Supabase, la verificación de sesión viva por Edge, RLS, revisión médica, firmas ni pruebas de dos organizaciones ficticias en una nube independiente. Ningún paciente real debe ser cargado.

**Siguiente gate:** `STAGING-01F-REMOTE` cuando exista entorno institucional nuevo y autorizado; como desarrollo autónomo previo, validar que el backend nunca entregue una fila con identificador duplicado, manteniendo separación de usuario/organización/episodio.

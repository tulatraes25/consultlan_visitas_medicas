# MOB-DATA-04 — Orden cronológico íntegro del roster Edge

**SPEC/Kiro · 2026-10-11 · únicamente datos sintéticos, sin despliegue.**

## Hallazgo y riesgo

`HC-READ-01` promete SQL ordenado por `scheduled_start ASC, id ASC` y máximo 100 coberturas. El cliente validaba campos, tiempos, unicidad y cardinalidad, pero aceptaba un arreglo devuelto en orden erróneo. Una guardia o visita podría mostrarse fuera de secuencia sin advertencia. No hay autorización local para `sort()` silencioso de resultados contradictorios: el servidor debe demostrar su contrato.

Además, el SQL **ordena desde las coberturas históricas más antiguas y limita a las primeras 100**, sin cursor ni filtro temporal. Con historiales extensos puede excluir turnos futuros. La bandera `possiblyTruncated` evita afirmar una agenda completa, pero **no resuelve ese problema**; sigue siendo NO-GO para agenda clínica operativa.

## Objetivo

Fallar cerrado cuando el backend no respete el orden temporal canónico de respuesta; preservar íntegra la proyección mínima y preparar un futuro gate separado de paginación.

## Requisitos

1. Solo validar el orden luego de validar los seis campos exactos, fechas ISO gregorianas, intervalos y UUID no duplicados de MOB-DATA-01/03.
2. Para filas consecutivas, exigir orden estrictamente ascendente por **instante UTC completo con precisión microsegundo**, desempate por UUID normalizado a minúsculas, como `ORDER BY scheduled_start, id` de PostgreSQL. Offsets distintos que representen el mismo instante deben desempatar por UUID.
3. No depender únicamente de `Date.parse` para microsegundos (el runtime JavaScript normalmente conserva solo milisegundos). Comparar segundo UTC + fracción decimal de seis cifras por separado. Mantener las cadenas ISO originales en la respuesta.
4. Una inversión de orden rechaza **toda** la lista con código fijo `ROSTER_NOT_CHRONOLOGICAL`, sin reordenar, tolerar parcialmente ni revelar valores al operador. El controlador de sesión borra inmediatamente cualquier snapshot previo.
5. Preservar `possiblyTruncated=true` si hay exactamente 100 filas; no inferir disponibilidad futura ni introducir navegación al historial, nuevas credenciales, SQL, endpoints, pacientes, formularios o firmas.
6. Testear: inversiones cronológicas, timestamps equivalentes con distintos offsets, diferencia microsegundo cuando el ID viene en orden opuesto, roster previo borrado y los 100 UUID distintos existentes.
7. CI: contratos y privacidad Node, PostgreSQL 16 RLS, Edge Deno y React Native TypeScript/Jest/exports Android/iOS.

## Archivos

- `apps/mobile/src/readonlyCoverageClient.ts`: control del orden canónico.
- `apps/mobile/src/coverageSessionController.ts`: código de fallo seguro.
- `apps/mobile/__tests__/readonlyCoverageClient.test.ts`, `CoverageSessionController.test.tsx`: pruebas positivas/negativas.
- `README.md`: índice de SPEC.

## NO-GO

La pantalla permanece aislada; no existe Supabase staging real ni autorización de atención clínica. **No conectar una agenda de uso asistencial sobre el RPC actual de las primeras cien coberturas históricas.** El siguiente gate necesario debe diseñar y verificar paginación o lectura acotada por ventana operativa, con acceso restringido y sin filtraciones de organización/episodio.

**Siguiente gate recomendado: HC-READ-02 — contrato paginado con cursor de servidor y validación de continuidad entre páginas.**

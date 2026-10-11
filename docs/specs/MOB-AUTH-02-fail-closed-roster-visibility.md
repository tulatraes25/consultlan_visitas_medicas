# MOB-AUTH-02 — Barrera de visibilidad anterior a Auth y cambio de contexto

**SPEC/Kiro · 2026-10-11 · sólo demo/staging sintético · no despliegue.**

## Hallazgo

MOB-AUTH-01 limpiaba datos de la agenda mediante `useEffect` al suscribirse a `onAuthStateChange`. Sin embargo, React puede renderizar el snapshot de `useSyncExternalStore` **antes** de ejecutar ese efecto. Si el controlador llega con una lista de una sesión anterior, existe una ventana de exposición visual aunque la limpieza posterior sea correcta. MOB-TIME-01, además, ocultaba filas con zona inválida pero al pasar de una zona válida a otra podía recalcular directamente **filas antiguas** con el nuevo huso.

## Objetivo

Fallar cerrado **desde el primer render**, no sólo en el efecto posterior, y destruir el roster en memoria al cambiar identidad del proveedor o zona temporal.

## Requisitos y restricciones

1. Desactivar botón y ocultar `ready/loading/error` y todas las filas hasta que exista una suscripción Auth de staging exitosa, asociada exactamente al `controller`, `authEvents` y `serviceTimeZone` recibidos. No usar sólo `current.state` para autorizar visibilidad.
2. Si Auth no provee `onAuthStateChange` y `unsubscribe` válidos, **no lanzar el error al árbol React** ni mostrar fila alguna: marcar la sesión como no vinculada, limpiar y cancelar el trabajo en progreso. Los errores upstream/tokens nunca se muestran ni registran.
3. Cualquier cambio de proveedor, controlador o zona horaria debe invalidar de inmediato la barrera de visibilidad al renderizar, limpiar/cancelar en el efecto de transición, cancelar el listener anterior y exigir una nueva consulta manual con la nueva vinculación.
4. Rechazar zona inválida sin mostrar filas y **vaciar memoria**, conservando los offsets por instante de MOB-TIME-01, sin leer zona del teléfono. El cambio de zona válida también descarta toda la agenda anterior.
5. Prohibir precarga automática o persistencia; no incorporar SDK Supabase, secretos, pacientes reales, SQL, Auth privilegiada, datos clínicos, documentos o firmas. La autorización de datos sigue siendo exclusivamente Edge+Auth+RPC, no el estado visual de React.
6. Pruebas con agenda sintética prellenada antes del mount, proveedor inválido, recambio Auth, cambio de zona válida e inválida, limpieza, cancelación y no fetch automático. CI 4/4 (Node, PostgreSQL, Deno, Expo TypeScript/Jest/bundles Android/iOS).

## Implementación

- `apps/mobile/src/StagingOwnRosterPreview.tsx`: barrera de render ligada a tupla de proveedor/controlador/zona; captura fallos de enlace sin arrojar payload de Auth.
- `apps/mobile/__tests__/CoverageAuthEvents.test.tsx`: preloaded/broken/provider-switch.
- `apps/mobile/__tests__/CoverageSessionController.test.tsx`: cambios de huso invalidan estado y no disparan red.
- `README.md`: documento indexado.

## NO-GO

No acredita permisos, identidad real ni despliegue clínico. La vista permanece desconectada de `App.tsx` y STAGING-01F-REMOTE continúa pendiente de un proyecto Supabase independiente aprobado, con cuentas sintéticas. No usar material clínico real.

**Siguiente gate:** asegurar integridad del orden cronológico de la respuesta Edge y evaluar formalmente el límite fijo de 100 coberturas antes de mostrarla como una agenda completa.

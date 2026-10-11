# MOB-DATA-02 — Límite de sesión para lectura de coberturas desde Edge

**SPEC/Kiro · 2026-10-11 · solo staging autorizado / pruebas sintéticas; sin instalación de Supabase real.**

## Hallazgo que corrige

MOB-DATA-01 creó el adaptador HTTP de solo lectura para la acción fija `listMyHomecareCoverages`, autorizada por Supabase Auth + sesión viva en Edge + RPC SQL restringido. Sin embargo, **una respuesta iniciada antes de un logout, cambio de usuario o salida de pantalla podía terminar más tarde**. Aunque el servidor hubiese autorizado correctamente la solicitud al comienzo, el cliente no tenía una política explícita para **borrar y descartar resultados atrasados**.

Una internación domiciliaria pediátrica necesita tanto límites de servidor como una gestión prudente del estado de pantalla. Este gate cubre la segunda parte, sin reemplazar a la primera.

## Objetivos y restricciones

1. `createCoverageSessionController(config)` conserva un destino Supabase **independiente**, un origen canónico, lista de refs prohibidos y publishable key verificados mediante `createReadOnlyCoverageClient`. No existe `service_role`, credenciales en archivos, selección de actor, organización, paciente, diagnóstico ni solicitud de datos clínicos.
2. **Zero network by default:** la construcción y la suscripción solo devuelven estado `idle`. Únicamente `refresh()` inicia la consulta. La pantalla tampoco la inicia automáticamente.
3. En cada refresco borrar primero los resultados anteriores, incrementar una generación y abortar la anterior. Un transporte que ignore `AbortSignal` **no** puede publicar una respuesta cuya generación haya quedado obsoleta.
4. Leer el JWT desde el proveedor Auth de este Supabase y volver a consultarlo antes de publicar filas. Si cambia durante la consulta, cancelar la publicación y mostrar el error fijo `ROSTER_SESSION_CHANGED`; nunca exponer dos agendas en una misma sesión visual. Esto no pretende verificar el JWT: el backend es autoridad sobre firma, sesión y permisos.
5. `clear()` vacía inmediatamente el estado y aborta la consulta; quien integre Auth deberá llamarlo **en el mismo momento** del cierre/cambio de sesión. `dispose()` limpia y desactiva por completo el controlador. No imprimir ni persistir JWT o información clínica en snapshots, logs, AsyncStorage ni disco.
6. La vista `StagingOwnRosterPreview` es un componente separado, **NO montado en `App.tsx`** porque no existe todavía un Supabase independiente probado ni un proveedor Auth instalado. Cuando corresponda, el usuario disparará explícitamente la lectura. Muestra solo modalidad, estado y horarios. Nunca exhibe raw IDs, nombres, domicilio, contactos, firmas ni indicaciones. La vista llama `clear()` al salir o poner la app en segundo plano.
7. Los errores no contienen respuestas del proveedor ni datos del paciente. Mostrar un mensaje neutral, bloquear datos ante fallas y advertir si 100 filas podrían significar paginación incompleta.
8. Mantener módulos DEMO actuales íntegramente separados. No habilitar login, firma, aprobación médica, registros clínicos ni prestaciones reales.

## Archivos y pruebas

- `apps/mobile/src/coverageSessionController.ts`: orquestación mínima de JWT/Edge, invalidación por época, cancelación, revalidación de token y snapshots inmutables.
- `apps/mobile/src/StagingOwnRosterPreview.tsx`: pantalla de staging no montada en la aplicación principal; consulta manual, sin datos personales, limpieza al salir/segundo plano.
- `apps/mobile/__tests__/CoverageSessionController.test.tsx`: pruebas React Native con transporte ficticio, sin red: no solicitud automática; sesión rotada; cancelación y respuesta tardía; dos solicitudes superpuestas; error sin detalles clínicos; token ausente; `dispose`; rechazo de refs de producción; rendering limitado y desmontaje.
- `.github/workflows/quality-gate.yml`: los 4 jobs existentes (privacidad Node, RLS PostgreSQL, Auth Deno, TypeScript/Jest/export JS Android e iOS) prueban el candidato antes del merge.

## Criterios de aceptación y NO-GO

CI 4/4 sobre el SHA de PR, diff restringido a controlador, componente, tests y docs. **No existe lectura real** hasta completar STAGING-01F-REMOTE, autenticar cuentas ficticias, probar cierre de sesión en proveedor real y validar exactitud de datos y límites SQL. La limpieza del cliente es una medida de defensa adicional: **NO sustituye Auth, RLS, autorización clínica, consentimiento ni política de datos**.

**Siguiente gate propuesto:** `MOB-DATA-03` — endurecimiento de integridad en los registros mínimos (IDs duplicados, validación temporal y respuestas con límites de tamaño) y pruebas de backend propias; por separado permanece bloqueado STAGING-01F-REMOTE, que requiere autorización institucional y el nuevo proyecto Supabase.

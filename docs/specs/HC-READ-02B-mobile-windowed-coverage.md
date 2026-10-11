# HC-READ-02B — Agenda móvil paginada, sesión y ventana vinculadas

**SPEC/Kiro · 2026-10-11 · solamente staging ficticio · aún sin despliegue.**

## Problema

HC-READ-02A agrega un backend de página 100+cursor, pero un cliente que cargue páginas sin coherencia entre ventana/actor podría mostrar registros mezclados tras cambios de sesión, huso horario o una respuesta tardía. Además, PostgreSQL `jsonb_build_object` serializa `timestamptz` con desplazamiento (`+00:00`) mientras el primer validador Edge de cursor exigía `Z`. La vista antigua de 100 coberturas históricas no sustituye el nuevo flujo.

## Requisitos

1. Crear un adaptador Edge **sin conexión automática** ni SDK Supabase instalado. Exigir `projectRef` staging permitido, lista excluida de proyectos, clave `sb_publishable_`, token Auth bajo demanda y fetcher definido. No aceptar `service_role`, credenciales de Pediatrics, URL externa, redirects ni lectura PostgREST.
2. Ventana de consulta definida por dos instantes ISO UTC, máximo 32 días, fecha real y extremos estrictos. No inferir domicilio o huso desde el dispositivo. Un sistema institucional deberá aprobar la zona `serviceTimeZone` y la política de intervalos.
3. Respuesta con sobre exacto `{ok:true,result:{rows,hasMore,nextCursor}}`, seis atributos **y sólo seis** por fila, hasta 100, orden por instante (microsegundo) + UUID. Fila fuera del rango solapado `[start,end)`, ID repetido, orden invertido, token ausente, cursor inválido, HTTP denegado o metadatos extra: fallo cerrado.
4. `nextCursor` debe coincidir **exactamente** con la última fila si `hasMore=true`; no aceptar cursor sin filas, más de cien, o cursor cuando no quedan páginas. Para paginar se transmite exactamente el último par recibido, no `OFFSET`, ni un actor/tenant elegido por móvil.
5. Cada página vuelve a obtener y revalidar el token actual. El controlador usa epoch + AbortController; rechaza respuestas tardías, rotación de JWT, replays y duplicados entre páginas; al fallar elimina **todas las filas acumuladas**. Limita memoria a 2000 filas (nunca marcar completa una lista truncada).
6. Componente `StagingPagedRosterPreview` no montado en `App.tsx`, con barrera de render vinculada a controlador, Auth, zona horaria y ventana. Cambios de estos parámetros borran memoria y bloquean la vista desde el primer render. Consultar y cargar próxima página **solo mediante controles explícitos**, nunca en bucles automáticos.
7. Corregir Edge para aceptar timestamp serializado por PostgreSQL con `Z` o desplazamiento ISO válido de hasta seis decimales; prohibir fechas imposibles, desfases invalidos, suplantes de identidad y credenciales en logs.
8. Mantener los límites clínicos: no pacientes reales, evoluciones, plan médico, consentimiento ni firmas. Sólo pruebas sintéticas con datos inventados y exhibición de tipo/estado/horario.

## Casos verificables

- 100 primeras coberturas con `hasMore=true` y cursor; pulsación siguiente obtiene 5, `hasMore=false`, sin IDs repetidos.
- Respuesta fuera de orden, duplicados, cursor ajeno a última fila o fuera de ventana: error y borrado atómico.
- Logout, cambio de usuario, token rotado, operación cancelada o reemplazo de proveedor Auth: ninguna respuesta pendiente repuebla tarjetas.
- Nuevo huso IANA o nueva ventana: se esconde la lista existente, se limpia y exige nueva interacción.
- No se muestran UUID, diagnóstico, datos familiares, dirección ni firma; mensajes explican que se trata de datos ficticios y no garantizan continuidad asistencial.
- CI: TypeScript estricto, Jest RN, export JS Android/iOS, Deno JWT/Edge con offset SQL, Node privacidad y PostgreSQL RLS en SHAs exactos.

## Límites y siguientes gates

El proveedor Auth sigue siendo **inyectado exclusivamente por un operador autorizado** y no existe una instancia Supabase staging desplegada. `hasMore=false` solo indica que no hay filas adicionales **en esa ejecución**, no inmovilidad del roster entre llamadas ni verificación de guardias. El circuito clínico, el plan, los permisos, la auditoría y las firmas necesitan autorización médica/legal/técnica. No enviar notificaciones asistenciales ni usar pacientes verdaderos.

**Siguiente gate:** STAGING-01F-REMOTE, solo cuando Pediatrics disponga formalmente de una instancia Supabase autónoma aprobada y cuentas/episodios sintéticos; hasta entonces la pantalla continúa desconectada.

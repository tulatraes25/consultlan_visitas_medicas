# HC-READ-02 — Paginación Keyset de agenda domiciliaria (fase backend)

**SPEC/Kiro · 2026-10-11 · estado: implementación GitHub sin despliegue · issue #48.**

## Hallazgo

La consulta previa `api_hc_list_my_coverages(p_actor)` devuelve las primeras cien asignaciones históricas ordenadas por inicio e ID. Puede ocultar turnos futuros a un profesional con amplio historial. Reemplazar el límite por una consulta sin cota tampoco es seguro por memoria, filtraciones, rendimiento y uso en teléfonos.

## Requisitos y diseño

1. **RPC nueva** `api_hc_list_my_coverages_page(p_actor,p_window_start,p_window_end,p_after_start DEFAULT NULL,p_after_id DEFAULT NULL)`, exclusivo `service_role`. Auth se resuelve server-side antes de la RPC. La cuenta debe conservar profesional, organización, membresía y equipo de episodio activos.
2. Ventana explícita de instantes UTC `[start,end)`, máximo 32 días reales, fechas admisibles entre 2000-01-01 y 2100-01-01. Se filtran coberturas que **se superponen a la ventana** (`scheduled_end > start AND scheduled_start < end`) para incluir guardias nocturnas previas al comienzo.
3. Cursor compuesto obligatorio en páginas siguientes, `scheduled_start` con precisión PostgreSQL y `id` UUID como desempate; `(start,id) > (cursorStart,cursorId)`; jamás `OFFSET`. Solo `LIMIT 101` interno para `hasMore`, y se exponen máximo 100 filas de seis campos. `nextCursor` describe exactamente la última fila visible cuando hay otra página.
4. Respuesta SQL: `{rows:[{id,episode_id,service_kind,coverage_state,scheduled_start,scheduled_end}],hasMore:boolean,nextCursor:{scheduled_start,id}|null}`. No incluir nombre, DNI, historia, paciente, profesional, dirección, prescripción, contacto, firma ni texto libre.
5. Edge valida JWT de usuario, identidad/Auth **y** sesión activa para **cada página**; no confía en ningún ID de actor, tenant, episodio ni profesional elegido por móvil. Acciones allowlisted `listMyHomecareCoveragesPage` (ventana) y `listMyHomecareCoveragesNextPage` (ventana y cursor). UTC ISO válido con hasta 6 decimales, nunca offset del teléfono.
6. Si falta media pareja de cursor, ventana vacía, intervalo excesivo o función no permitida: denegar. No habilitar lecturas directas a PostgREST, escritura o RPC clínicas.
7. **Integridad concurrente:** Keyset elimina repeticiones propias del OFFSET; **no provee snapshot** entre llamadas HTTP. Inserciones, cancelaciones, cambios de asignación o revocaciones deben tener consecuencias explícitas para el cliente, que nunca afirmará completitud asistencial ni hará paginación automática. Carga de páginas futura requiere preservar la misma ventana, descartar duplicados y limpiar sesión en error.
8. Crear migración 12 sin modificar las once previas; STAGING-01A/D/E, migración history, runbook y CI deben reconocer exactamente 12. Pruebas negativas con 105 prestaciones inventadas, cambio de pertenencia, organizaciones ajenas, admin denegado, turno nocturno y ventanas inválidas.

## No implementado en fase backend

Interfaz móvil paginada todavía no conectada. Sigue inerte la pantalla anterior de demostración, sin capacidad de consulta clínica en producción. Un control posterior validará continuidad entre páginas, ventana elegida por operador autorizado, limpieza en cambio de sesión y navegación manual. **No hay Supabase real enlazado, pacientes reales, firma, validación de planes, certificados ni aprobaciones médicas.**

## Criterios de aceptación

`PostgreSQL 16` ejerce 105 asignaciones sintéticas: página de 100 con `hasMore=true` y cursor, segunda de cinco sin cursor, sin duplicación, con aislamiento de organización, equipo y actor revocado. Deno comprueba URL/RPC fija, Auth y sesión por página y denegación de suplantes. Node valida manifiesto de doce migraciones y catálogos; Expo se mantiene sin cambio operativo. La etapa solo será `CLOSED_CERTIFIED` tras 4/4 CI en PR, merge normal y post-main 4/4.

**Siguiente gate:** HC-READ-02B móvil — cliente de páginas y controlador de sesión ligado al cursor, UI opcional de staging con intervención humana y pruebas RN de cientos de filas, sin instalar Supabase.

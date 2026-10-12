# HC-READ-04 — Filtro de privacidad en la respuesta Edge de agenda paginada

**SPEC/Kiro · 2026-10-12 · seguridad defensiva · solo pruebas sintéticas**

## Hallazgo
El lector móvil HC-READ-02B ya rechazaba respuestas con atributos adicionales, pero Edge devolvía de manera directa `result.data` del RPC `api_hc_list_my_coverages_page`. Una regresión SQL que añadiera diagnósticos, identidad de pacientes, firmas o campos arbitrarios podía enviarlos por la red **antes de que el teléfono los rechazara**. La autorización de la consulta y la forma del resultado son dos controles independientes.

## Requisitos
1. Edge verifica el sobre exacto `{rows,hasMore,nextCursor}`, con booleano, máximo 100 filas y campos exactos por fila: `id`, `episode_id`, `service_kind`, `coverage_state`, `scheduled_start`, `scheduled_end`. Ningún atributo libre/PII adicional.
2. UUID de cobertura y episodio válidos; tipo `VISIT|SHIFT`; estado de la lista conocida; fecha gregoriana ISO con hasta seis decimales y zona válida. Intervalo positivo y **solapado** con la ventana UTC explícita de la petición.
3. No aceptar IDs duplicados, fechas invertidas, orden no canónico, filas iguales o anteriores al cursor; si `hasMore=true`, exactamente 100 filas y cursor idéntico a la última.
4. Páginas vacías (o última página menor a cien) solo con `hasMore=false` y `nextCursor=null`.
5. Ante cualquier fallo de esquema/semántica, Edge devuelve **502 fijo sin datos**, no propaga el cuerpo de SQL ni diagnósticos, nombres, firma, UUID o mensaje del backend.
6. Mantener Auth + sesión viva, permisos multi-organización, paginación del backend y el bloqueo del endpoint legado HC-READ-03. No introducir conexión real ni credenciales nuevas.
7. Deno prueba 100+cursor válido, última página, respuesta malformada, campos PHI, calendario, ventana, duplicación, orden y cursor. Quality Gate completo; PR y post-main PASS.

## Diseño
`safeRosterPage(result.data,sanitized.args)` se ejecuta en `supabase/functions/visits/handler.ts` **después de SQL** y **antes de JSON HTTP**, exclusivamente para RPC `api_hc_list_my_coverages_page`. El contrato móvil conserva su propia validación redundante. El chequeo no reemplaza RLS, JWT, funciones SQL ni la autorización clínica.

## NO-GO
Solo staging ficticio. La salida de Edge protegida no acredita que las asignaciones sean correctas, que el plan esté aprobado o que existan autorizaciones médicas, consentimientos o firmas. Requiere pruebas STAGING-01F reales sobre proyecto Supabase independiente antes de cualquier paciente.

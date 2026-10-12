# HC-READ-03 — Retirar consulta antigua de agenda sin ventana

**SPEC/Kiro · 2026-10-12 · Edge/contrato offline · staging no creado**

## Problema verificable
La ruta legada `listMyHomecareCoverages` consulta el RPC `api_hc_list_my_coverages`, que ordena desde coberturas históricas y devuelve como máximo cien. Un profesional con historia extensa podría recibir una agenda sin sus asignaciones futuras y entender erróneamente que no tiene trabajo. El contrato nuevo HC-READ-02 usa ventana temporal explícita y paginación keyset, con sesión Auth verificada para cada petición.

## Decisión
1. Retirar **del allowlist Edge** la acción sin ventana. Una petición con JWT válido recibe **422** y nunca invoca el SQL, sin exponer errores ni datos clínicos.
2. Mantener intacta la migración histórica y su RPC exclusiva de service_role por compatibilidad con el registro exacto de **13 migraciones**. No reescribir historial ni migrar un servidor real.
3. Conservar las dos acciones de primera página y siguiente página, con ventana UTC máxima de 32 días, cursor microsegundo/UUID, RLS y revalidación de sesión por cada solicitud.
4. El validador STAGING-01A rechaza si vuelve a aparecer la ruta antigua en el bloque `COMMANDS` de Edge; el control es probado con un handler sintético inyectado.
5. Los lectores antiguos de mobile siguen **dormidos**, solo como harness de pruebas estructurales; no deben montarse ni mostrar una agenda clínica. El único flujo móvil candidato usa `StagingPagedRosterPreview` a través de HC-UX-04D.
6. Sin servicio alojado, pacientes, datos de consultorio, firmas, documentos clínicos ni operaciones de red nuevas.

## Aceptación
- Deno: `listMyHomecareCoverages` con Auth/sesión activa => 422, ningún comando SQL; scopes falsos también => 422; credenciales vencidas/invalidas siguen => 401/503 antes del dispatch.
- Deno: las dos rutas paginadas aún permiten al actor autorizado y reciben exactamente el `p_actor` de Auth, no de payload.
- Node: `checkStagingSource` falla cerrado al reintroducir la ruta antigua.
- CI: PostgreSQL RLS, Edge Deno, contratos y privacidad Node, Expo strict TS/Jest y Chrome/Firefox/WebKit 5/5; merge normal y post-main 5/5.

## No-go
Las pruebas con fixtures demuestran el contrato y el retiro del endpoint viejo, **no** la completitud real del roster bajo modificaciones concurrentes. Hacen falta Supabase staging **autónomo**, dos identidades ficticias y pruebas remotas STAGING-01F con revocación de sesión y cross-tenant; no autoriza pacientes reales.

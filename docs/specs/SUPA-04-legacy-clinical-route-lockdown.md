# SUPA-04 — Retiro de rutas clínicas heredadas de la Edge

**SPEC/Kiro · Solo datos sintéticos, sin Supabase instalado ni pacientes reales.**

## Hallazgo y decisión
SUPA-03 conservaba comandos del prototipo de visitas ambulatorias, anteriores al modelo longitudinal HC-01/02. Esos comandos permitían intentar programar una visita sin episodio o solicitar inicio, anotaciones, revisión y cancelación clínica sin el circuito de Dirección Médica. El SQL de HC-01 ya bloqueaba varias de esas rutas, pero depender de fallas posteriores no es una defensa suficiente.

## Requisitos
- R1. Retirar del allowlist Edge: `scheduleVisit`, `beginVisit`, `addClinicalNote`, `submitVisitReview`, `cancelVisit`.
- R2. Mantener exclusivamente alta administrativa de paciente/profesional propios, comandos HC-02B con restricciones SQL y `requestHomecarePlanReview` de HC-02C1B (PENDING).
- R3. Rechazar toda operación retirada con HTTP 422, incluso con JWT sintético válido y parámetros aparentes completos, **sin invocar ninguna RPC**.
- R4. Conservar denegaciones por token inválido, exceso de campos, actor aportado por cliente, cambios de roles, secrets y error de backend. El contrato de Gateway debe ser una lista cerrada.
- R5. No eliminar ni modificar migraciones históricas de manera destructiva en este gate; las RPC antiguas siguen existiendo para pruebas SQL de legado y deberán revisarse/revocarse antes de staging. No confundir inaccesibilidad desde la Edge con protección ante claves privilegiadas robadas.
- R6. No se añaden capacidades de firma, activación, notas clínicas ni pacientes reales.

## Implementación y verificación
- `supabase/functions/visits/handler.ts`: recorte del allowlist y tipos obsoletos.
- `supabase/functions/visits/handler.test.ts`: prueba de bloqueo explícito y regresiones de rutas permitidas.
- Contrato `docs/specs/SUPA-03-edge-auth-gateway.md` y README de Supabase sincronizados.
- Quality Gate: Deno check/test, Node/contratos, PostgreSQL RLS, TS/UX/exports Android-iOS.
- PR CI completo sobre SHA exacto; merge normal; push CI post-main. Sin esta última evidencia no declarar CLOSED_CERTIFIED.

## Próximos controles necesarios
1. En staging autónomo, auditar las RPC históricas y reducir grants de service_role cuando el esquema y suites se hayan migrado completamente.
2. Probar autenticar y autorización realmente con Supabase Auth, Edge Functions y RLS contra cuentas sintéticas; testear revocación y aislamiento de organización.
3. Diseñar acceso profesional a contenido clínico después de habilitaciones, planes reales aprobados y controles institucionales.

# MOB-HC-REVIEW-01 — Cola móvil de revisión, solo demostración

**Fecha:** 2026-10-10. **Modo:** SPEC/Kiro. No producción, sin proyecto Supabase, sin pacientes reales.

## Contexto
El gate HC-02C1B añadió una solicitud administrativa pendiente por versión de plan. El circuito de aprobación clínica, autorización del menor y firma sigue bloqueado. La aplicación para teléfonos y tablets necesita representar esa separación sin sugerir que existe capacidad clínica real.

## Requisitos
- R1: la pestaña **Gestión → Revisiones** funciona en Android/iOS, teléfonos y tablets, con controles táctiles accesibles y estética CONSUL​TLAN.
- R2: muestra solamente referencias inventadas de episodios, plan versionado y estados PENDIENTE; nunca nombres, domicilios, DNI, diagnósticos, medicación, consentimientos o datos de Pediatrics ambulatorio.
- R3: el cartel identifica claramente que una solicitud de revisión no aprueba un plan, no firma y no activa atención.
- R4: la vista es solo lectura; no hay acción Aprobar, Firmar, Activar, guardar, enviar ni URL Supabase.
- R5: no hay cambio de esquema ni salida de red, persistencia, autenticación real ni ficheros médicos.
- R6: pruebas de navegación teléfono/tablet y negación de controles clínicos.

## Implementación
- `apps/mobile/src/PlanReviewQueueDemo.tsx`: dos estados de revisión sintéticos PENDIENTE, sin elementos interactivos.
- `apps/mobile/src/AdminWorkspaceDemo.tsx`: nueva sección dentro de Gestión, sin interferir con las listas y agendas existentes.
- `apps/mobile/__tests__/App.test.tsx`: pruebas interactivas de lectura y ausencia de acciones peligrosas.

## Gate CI
Mantener pruebas PostgreSQL y Edge HC-02C1B, contratos Node, typecheck Expo estricto, UI Jest 390/1280 dp y exportación JS Android/iOS. Certificar el head exacto, merge normal y verificar CI push de main.

## Fuera de alcance / Siguiente paso
Una lista ficticia no prueba lectura segura de una tabla RLS ni representa un profesional médico habilitado. La aplicación sigue sin usar pacientes o planes reales. El gate siguiente debe priorizar integración a staging autónomo con Auth/RLS (cuentas de ensayo únicamente) o ampliar el registro administrativo por episodios, según infraestructura disponible.

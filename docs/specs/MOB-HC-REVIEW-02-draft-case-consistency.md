# MOB-HC-REVIEW-02 — Cola ficticia de revisión vinculada a versiones de borrador

**SPEC/Kiro · 2026-10-11 · pantalla móvil informativa · sin datos reales.**

## Hallazgo

La cola existente `PlanReviewQueueDemo` enumeraba `CASO-DEMO-A/B`, distintos de los identificadores `DEMO-EPI-A/B` usados por la agenda, las coberturas y el resumen del plan. Esto podía dar la impresión de que una solicitud administrativa de revisión equivalía a un episodio diferente o a un plan aprobado.

El sistema de internación domiciliaria debe conservar **una identidad de episodio consistente y una versión exacta del borrador** en todos los módulos. No debe deducir que un plan fue revisado o aprobado por mostrar su versión.

## Requisitos

1. Introducir catálogo **separado** de solicitudes ficticias `DEMO_PENDING_REVIEWS`: un plan DRAFT puede existir sin que nadie haya solicitado revisión. La solicitud no es una transición de estado clínico ni una firma.
2. Cada solicitud `REV-DEMO-<CASO>-<VERSIÓN>` debe corresponder a la pareja `DEMO-PAT-<CASO>` / `DEMO-EPI-<CASO>` y a una versión exacta existente del catálogo `DEMO_PLAN_DRAFTS`, siempre en estado `DRAFT`.
3. La proyección `projectDemoPendingReviews` debe rechazar un lote entero si contiene solicitudes duplicadas, estado `APPROVED`, otra identidad de paciente/episodio, número de versión inválido, campos clínicos extra o una versión no existente. No convertir un error en aprobación ni devolver información sensible.
4. Mostrar únicamente ID sintético de solicitud, episodio DEMO, número de versión y etiqueta **PENDIENTE**. No mostrar profesional revisor, firma, fecha/hora clínica, medicación, diagnóstico, evolución, paciente real o consentimiento supuesto.
5. Mantener la cola navegable en teléfono/tablet dentro de Gestión → Revisiones. Un botón de aprobar, firmar o activar está expresamente prohibido. Cuando una proyección es vacía, mostrar mensaje informativo.
6. No conectar el componente con Supabase ni autorizar acciones basadas en roles visuales. Los permisos, identidad y auditoría futuros corresponderán a Auth+Edge+RPC en proyecto independiente verificado; los datos de Pediatrics ambulatorio jamás se importarán.

## Implementación y aceptación

- `apps/mobile/src/reviewQueueDemo.ts`: fixture inmutable con dos solicitudes y función pura de correlación con `planDraftDemo.ts`.
- `apps/mobile/src/PlanReviewQueueDemo.tsx`: presentación del resultado sanitizado, sin campos editables ni controles de aprobación.
- `apps/mobile/__tests__/PlanReviewCaseConsistency.test.tsx`: positivos A1/B2, negativos solicitud sin plan exacto, status aprobado, identidad falsificada, ausencia/duplicación, número imposible, campos clínicos extra, orden estable y UI de solo lectura.
- `apps/mobile/__tests__/App.test.tsx`: verificación de IDs canónicos `DEMO-EPI-A/B` en teléfono/tablet.
- Quality Gate GitHub con Node, PostgreSQL 16, Deno Edge, TS/Jest y bundles JS Android/iOS.

## Riesgo y NO-GO

`PENDIENTE` significa únicamente que existe una **solicitud ficticia**; no indica aceptación por Dirección Médica, vigencia, admisión, autorización de prestaciones ni firma electrónica/digital. El plan de cuidados real continúa bloqueado hasta la validación médica y jurídica, Supabase staging independiente, pruebas de sesión/revocación, habilitación de profesionales, identidad de familiares y firma/documentos privados con control de acceso.

**Siguiente gate:** `STAGING-01F` para ensayos reales autorizados en Supabase con dos organizaciones ficticias; como gate móvil paralelo, diseñar una separación explícita de vistas profesional/coordinación, sin simular seguridad de acceso mediante controles locales.

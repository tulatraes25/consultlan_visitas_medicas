# MOB-HC-PLAN-01 — Vista de metadatos de borrador de plan por episodio

**SPEC/Kiro · 2026-10-11 · Expo React Native, teléfono/tablet · solo datos sintéticos.**

## Objetivo y antecedente

La internación domiciliaria pediátrica no se organiza como un turno de consultorio. Cada paciente del programa posee un episodio longitudinal que, cuando Dirección Médica lo apruebe, podrá tener versiones de planes de cuidados y coberturas. El esquema HC-01 contiene `homecare_care_plan_versions` (versión numérica, estados `DRAFT`, `APPROVED`, `SUPERSEDED`) pero **no habilita la aprobación clínica**. La pantalla móvil muestra ahora exclusivamente datos ficticios que ilustran esa distinción, sin simular planes reales.

## Requisitos de seguridad y criterios de aceptación

1. **No se leen datos de Supabase**. `DEMO_PLAN_DRAFTS` es un inventario inmutable local y tiene IDs `DEMO-PAT`, `DEMO-EPI`, `DEMO-PLAN` incompatibles con identificadores clínicos reales.
2. Toda proyección exige identidad **exacta de paciente y episodio**; para este prototipo los códigos de un mismo caso coinciden en su sufijo. No se muestran planes de otro paciente aun cuando un código de episodio se falsifique.
3. Solo admitir estado `DRAFT`, versión positiva entera entre 1 y 999 e identificador de plan calculado con el código DEMO del paciente y número. Rechazar duplicados de versión, campos imprevistos, estados `APPROVED` o `SUPERSEDED`, valores arbitrarios, versiones inválidas o registro ambiguo. Un dato inválido jamás puede convertirse en aprobación implícita.
4. Exponer al componente únicamente **versión numérica más alta, cantidad de borradores y marcador «BORRADOR · SIN APROBACIÓN»**. La estructura de proyección no incluye diagnóstico, indicación, medicación, profesional aprobador, firma, receptor, datos del cuidador ni textos libres.
5. En la pantalla **Gestión → Episodios**, mostrar un bloque informativo con versión y marcador; si no existe metadato válido, presentar estado vacío, sin inventar un plan. Al seleccionar otro episodio se sustituye inmediatamente todo el contenido anterior.
6. No presentar controles que aprueben, firmen, activen, prescriban, modifiquen o envíen datos a la nube. No confundir la existencia de un borrador o solicitud de revisión con autorización a una prestación domiciliaria.
7. Mantener la UI verde existente y los tamaños táctiles; la nueva sección es estrictamente de solo lectura y no contiene `TextInput`, PDF, dibujo de firma ni captura clínica.

## Implementación

- `apps/mobile/src/planDraftDemo.ts`: catálogo inmutable y función pura `demoPlanDraftSummary` con doble alcance paciente/episodio y rechazo de registros malformados.
- `apps/mobile/src/EpisodeOverviewDemo.tsx`: sección «Plan de cuidados · vista estructural» y aviso explícito de que no hay órdenes ni autorización.
- `apps/mobile/__tests__/EpisodePlanDraftDemo.test.tsx`: positivo A/B (versión 1 / versión 2), estado vacío, cruces entre identidades, versiones duplicadas, firma/diagnóstico añadidos, fechas y nombres reales no reflejados, cambios de episodio, botones clínicos ausentes.
- Quality Gate existente: Jest React Native, TypeScript estricto, export JS Android/iOS, tests Node de contratos, Deno Auth y PostgreSQL RLS.

## Límites y NO-GO

El catálogo DEMO no deriva ni certifica planes realmente aprobados. La versión del esquema `APPROVED` en fixtures SQL de pruebas no refleja una aprobación médica; solo sirve para demostrar integridad y permisos PostgreSQL. El sistema clínico real necesita Dirección Médica, profesional habilitado, identidad del menor/representante, consentimiento, documentos/firma, seguridad y retención de información, auditoría, backup/restauración y Supabase independiente probado con identidades sintéticas.

**Gate siguiente:** STAGING-01F (validación real de infraestructura Supabase con permiso institucional) y, en el frente móvil sin datos reales, `MOB-HC-SCOPE-01` para separar explícitamente navegación del profesional y coordinación, sin activar permisos clínicos basándose en componentes del cliente.

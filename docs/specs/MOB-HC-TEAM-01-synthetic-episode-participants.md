# MOB-HC-TEAM-01 — Profesionales con coberturas de demostración por episodio

**SPEC/Kiro · 2026-10-11 · teléfono y tablet · totalmente offline y sintético.**

## Problema y objetivo

La vista domiciliaria está orientada al episodio longitudinal, pero hasta ahora solo mostraba una lista de guardias/visitas y un posible relevo horario. Para coordinación hace falta identificar de manera rápida **qué tipos de profesionales figuran en las coberturas de un episodio**, sin confundir ese dato con un equipo de cuidados aprobado o profesionales habilitados.

El nuevo bloque es estrictamente una **proyección de cobertura ficticia**, no un padrón de profesionales real, ni una herramienta de designación o verificación de matrícula.

## Requisitos

1. Selección de paciente y episodio idénticos, reutilizando `demoEpisodeCoverages`. Jamás agregar un profesional de otro paciente o episodio, aunque se falsifique el mismo código de episodio.
2. Para contar una visita o guardia, el profesional debe existir en el **registro ficticio local**, su identificador debe cumplir el formato `DEMO-PRO-...` y la especialidad de la cobertura debe coincidir con la especialidad ilustrativa registrada. No admitir valores de modalidad desconocidos.
3. Calcular cantidad de `VISIT`/`SHIFT` por profesional, evitando duplicar la misma referencia de cobertura. Ordenar por especialidad y código sintético. No inferir asistencia real, aceptación de cobertura, presencia domiciliaria ni continuidad clínica.
4. Etiquetas de profesional **derivadas del identificador sintético**, no de un campo libre de nombre. Si el identificador no es sintético, mostrar «Profesional ficticio no identificado».
5. Mostrar dentro del episodio el listado y sus totales; si no hay coberturas, estado vacío. Cambiar de episodio elimina inmediatamente a los participantes del caso anterior.
6. Mantener visible que un profesional en una agenda ficticia **NO** equivale a integrante activo del equipo asistencial, matrícula verificada ni autorización médica.
7. Sin Auth, Supabase real, órdenes, historias, nombres de menores, firmas, aceptación de guardias, escritura persistente ni llamadas de red.

## Diseño y pruebas

- `apps/mobile/src/EpisodeOverviewDemo.tsx` incorpora una función pura `demoEpisodeParticipants`, generador de etiqueta `syntheticProfessionalLabel` y una sección informativa debajo de los conteos del episodio.
- `apps/mobile/__tests__/EpisodeParticipantsDemo.test.tsx` prueba conteos, deduplicación, paciente/episodio falsificados, especialidades incompatibles, profesionales no registrados, valores de modalidad inválidos, ocultación de nombres inyectados, cambio de episodio y estado vacío.
- El Quality Gate completo conserva Node, PostgreSQL 16, Edge Deno, TypeScript, Jest y export JavaScript Android/iOS.
- El backend de futuro consultará membresías y equipo real mediante Auth/Edge/RPC con RLS/controles SQL y paginación. Ningún estado local de esta pantalla otorga permisos.

## Criterio NO-GO

No registrar, firmar, acreditar ni exportar un equipo clínico basándose en estas coberturas. El personal real debe verificarse contra habilitación profesional, identidad, especialidad/competencia, membresía y vínculo activo con el episodio, bajo un proceso aprobado por Pediatrics.

**Siguiente gate:** `MOB-HC-PLAN-01`: previsualizar únicamente metadatos seguros del plan de cuidados en relación con el episodio, sin indicaciones, medicación, diagnósticos ni activación; consultar documentación y decisiones institucionales antes de diseñar datos clínicos.

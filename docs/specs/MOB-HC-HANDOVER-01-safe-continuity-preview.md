# MOB-HC-HANDOVER-01 — Continuidad horaria de guardias en episodio (solo demo)

**SPEC/Kiro · 2026-10-11 · React Native/Expo teléfonos y tablets · 100% sintético.**

## Contexto y problema identificado

La internación domiciliaria pediátrica se organiza en episodios longitudinales y coberturas de profesionales, no en turnos de consultorio. La demostración existente distingue `VISIT` y `SHIFT` y permite cambios consecutivos de guardia. Sin embargo, `findDemoContinuityHints` exigía coincidencia de `episodeRef` y distintos profesionales, **pero no coincidencia de `patientRef`**. Dos filas ficticias con el mismo código de episodio y pacientes distintos podían generar un falso indicio de relevo.

Aunque la aplicación aún no contiene pacientes verdaderos ni conexión Supabase, se corrige ahora el contrato para evitar perpetuar una asociación errónea en el futuro.

## Objetivos y requisitos

1. **Misma persona y mismo episodio:** una posible continuidad requiere igualdad exacta de `patientRef` **y** `episodeRef`, formatos `DEMO-PAT-*` y `DEMO-EPI-*` válidos, IDs de filas/profesionales exclusivamente sintéticos y profesionales distintos.
2. Ambas coberturas deben ser `SHIFT` y sus intervalos civiles `[inicio, fin)` **consecutivos exactamente**. Admitir guardias nocturnas, cruces de fecha y duración ilustrativa de hasta 24 horas. Rechazar superposiciones, intervalos inválidos y huecos, sin convertir minutos civiles en autoridad clínica.
3. La pantalla `Gestión → Episodios` obtiene candidatos **solo de `demoEpisodeCoverages`**, que filtra por paciente y episodio, antes de proyectarlos. Nunca mezclar otro episodio o paciente ni renderizar registros falsificados.
4. Mostrar referencias ficticias saliente→entrante, hora de cambio y profesionales ficticios. El mensaje visible debe advertir **SIN RELEVO ACREDITADO** y no incluir acciones de aceptar, confirmar, firmar, transferir indicaciones o registrar evolución.
5. Sin casos consecutivos, mostrar estado vacío específico. Cambiar de episodio elimina todos los indicadores de la selección anterior.
6. No crear nuevas escrituras, tokens, storage, llamadas de red ni estado clínico. Ningún dato de esta demo podrá usarse como confirmación de disponibilidad/competencia profesional, entrega de guardia o continuidad de cuidados real.

## Verificación

- `apps/mobile/src/coverageDemo.ts`: función pura reforzada con doble alcance paciente/episodio e identidades ficticias.
- `apps/mobile/src/EpisodeOverviewDemo.tsx`: vista de posibles continuidades dentro de un solo caso, sin interacción clínica.
- `apps/mobile/__tests__/AdminWorkspace.test.tsx`: rechazo de mismo episodio falsificado para otro paciente, filas incompletas, límites no consecutivos y formatos inválidos.
- `apps/mobile/__tests__/EpisodeOverviewDemo.test.tsx`: cobertura nocturna positiva, render controlado, prohibición de controles clínicos, transición a otro episodio y ausencia de contaminación cruzada.
- GitHub Quality Gate exige React Native Jest/TypeScript, bundles JS Android/iOS, contratos Node, Deno Auth/Edge y PostgreSQL 16.

## Riesgos y siguiente paso

El indicador es exclusivamente una coincidencia horaria. Un relevo real requiere aceptación explícita por profesionales habilitados, identificación del paciente y representante autorizado, plan vigente, entrega estructurada de información, auditoría, verificación de sesión y criterios aprobados por Dirección Médica. Los datos del domicilio, las notas, la medicación, los procedimientos y las firmas no forman parte de este gate.

**Próximo gate funcional:** `HC-HANDOVER-02` — contrato servidor de propuesta/aceptación de relevo con permisos y trazabilidad; se implementará únicamente después de acordar el proceso profesional y de probar Supabase independiente con datos ficticios. La UI de demo no habilita actos asistenciales.

# MOB-HC-EPISODE-01 — Vista de episodio longitudinal en teléfono y tablet

**SPEC/Kiro · datos exclusivamente sintéticos · sin Supabase desplegado · no apto para pacientes.**

## Problema
La app de demostración ya representaba visitas puntuales, guardias y equipos, pero el acceso administrativo priorizaba el listado de pacientes y las asignaciones individuales. En internación domiciliaria pediátrica, la unidad conceptual correcta es el **episodio asistencial**, que reúne coberturas sucesivas, posibles relevos y documentos clínicos solo cuando estos sean formalmente aprobados. Ningún turno de consultorio debe importarse ni vincularse.

## Requisitos y criterios de aceptación
1. En **Gestión → Episodios**, ofrecer un listado táctil de episodios inventados identificados como `DEMO-EPI-...`, sin nombres ni domicilios reales; agregar automáticamente los nuevos episodios ficticios creados en memoria en la misma sesión.
2. Seleccionar un episodio muestra únicamente prestaciones cuyo `patientRef` **y** `episodeRef` correspondan exactamente al paciente/episodio. No mezclar otro episodio del mismo paciente ni la misma referencia de episodio de otro paciente; rechazar filas sin relación completa.
3. Agrupar visualmente las coberturas del episodio en una línea de tiempo de muestra con modalidad `VISIT` o `SHIFT`, fecha, horario, especialidad, referencia del profesional sintético y estado de demostración. Mantener la distinción entre visita y guardia y el orden de fechas, sin transformar continuidad horaria en relevo clínico acreditado.
4. Mostrar conteos de visitas/guardias e indicar de manera inequívoca que no existe autorización de admisión, plan médico aprobado, matrícula comprobada, firma válida, evolución médica, permiso clínico ni conexión con pacientes de la clínica ambulatoria.
5. Toda la vista será **solo lectura**. Sin `fetch`, SDK Supabase, escritura, subida de archivos, registro clínico, firmas, confirmación de prestadores ni inferencia de status `ACTIVE`.
6. Estado vacío claro cuando un episodio ficticio no tenga coberturas. El componente debe funcionar tanto en teléfono como en tablet y respetar los tamaños táctiles del proyecto.

## Diseño y alcance
- `apps/mobile/src/EpisodeOverviewDemo.tsx`: proyección de la agenda por identificadores locales de episodio/paciente; fechas civiles solo ilustrativas, no representación definitiva de la zona horaria de producción.
- `apps/mobile/src/AdminWorkspaceDemo.tsx`: sección Episodios junto a Pacientes, Profesionales, Asignaciones y Revisiones.
- `apps/mobile/__tests__/EpisodeOverviewDemo.test.tsx`: aislamiento entre episodios, selección, estado vacío y guardias.
- `apps/mobile/__tests__/App.test.tsx`: navegación en pantalla de teléfono y tablet.

## Verificación
Quality Gate en HEAD exacto: React Native + Expo TypeScript estrictos, Jest UI, exportación JS Android/iOS, contratos de seguridad Node, Auth Deno y RLS PostgreSQL. Un bundle JavaScript no equivale a APK/IPA ni acceso real a datos.

## Riesgos y siguiente gate
El nuevo módulo no demuestra que los permisos profesionales de producción estén correctos; la matriz de acceso clínico depende de Dirección Médica, privacidad/legal y ensayos en Supabase autónomo real. Tampoco prueba continuidad clínica ni auditoría de relevos. Próximo gate: diseño de lectura del episodio vía backend autorizado y RLS no vacío, **solo tras STAGING-01A/B/C y validaciones institucionales**. Hasta entonces se mantiene como demo íntegramente local.

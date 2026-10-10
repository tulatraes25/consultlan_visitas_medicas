# MOB-ROSTER-02 — Agenda móvil de visitas y guardias variables (demo)

**SPEC/Kiro — 2026-10-10**. Repositorio: `tulatraes25/consultlan_visitas_medicas`.
**Estado:** candidato GitHub-first sujeto a CI, merge normal y CI post-main.

## Fuente y decisión

HC-01/HC-02A/HC-02B establecen que **la internación domiciliaria se organiza por episodio**, equipo y plan habilitado, con un roster único de coberturas `VISIT` (visita puntual) y `SHIFT` (guardia). La interfaz administrativa anterior (`MOB-ADMIN-01`) ofrecía turnos rígidos de 40 minutos del prototipo. **No representan la cobertura prolongada de enfermería o cuidadores.**

La app es para pacientes exclusivos del programa domiciliario, **sin vínculo con historias ni servidor del consultorio Pediatrics**. Sus formularios siguen los originales de Pediatrics (FORM-001, HC-03A/03B), sin cambiar las hojas físicas de Kardex, signos, procedimientos y crisis.

## Requisitos

1. En **Gestión → Asignaciones**, seleccionar paciente/episodio ficticio, profesional ficticio, tipo `VISIT` o `SHIFT`, fecha `AAAA-MM-DD`, comienzo y fin `HH:mm`.
2. Se admite duración variable desde un minuto hasta **24 h por cobertura** como límite técnico del backend HC-02B, no como pauta clínica. Si el horario de fin es menor o igual al inicio, se refiere al día siguiente. Se muestra `(+1 día)` y duración calculada.
3. Validar fechas existentes (años 2000–2099 en demo), formato de reloj 24h y entradas inválidas. El día siguiente se propone solo como valor inicial; no hay horario ni fecha inmutables.
4. **Evitar cualquier cruce** de intervalos del mismo profesional, incluidas superposiciones VISIT vs SHIFT, cambios de paciente y límites entre dos fechas. Intervalos `[inicio,fin)`: guardias contiguas no se superponen.
5. Un evento finalizado del prototipo sigue ocupando su intervalo histórico: no permitir reescribirlo como si el profesional nunca hubiera estado ocupado.
6. Identificar **posible continuidad horaria** cuando dos SHIFT comparten episodio sintético, el último instante del primero coincide exactamente con el primero del segundo y tienen profesionales distintos. **Nunca** mostrarlo como relevo efectuado, firmado o aceptado.
7. Mostrar `Visita puntual` o `Guardia prolongada` y un rango entendible en agenda y detalle. Mantener las pruebas existentes de Inicio, Agenda, Planillas, Gestión y lienzo de firma puramente demostrativo.
8. Exclusivamente `useState`/fixtures de React Native: **sin red, Supabase, AsyncStorage, Storage, firma real, tratamiento, orden médica ni datos identificables**. Cada paciente ficticio tiene un único episodio sintético separado; el roster verdadero se vinculará a episodios auténticos mediante backend y Auth.

## Diseño / implementación

- `apps/mobile/src/coverageDemo.ts`: funciones puras de fecha/hora civil, intervalos, formato, detección de cruces, duración y candidatos de continuidad. No es motor de agenda clínica.
- `apps/mobile/src/demoData.ts`: ahora cada registro trae `serviceKind`, `startTime`, `endTime`, y referencias sintéticas de paciente/episodio/profesional. No se duplican campos de horario textual.
- `apps/mobile/src/adminDemoData.ts`: generador de VISIT/SHIFT variable y exclusión en memoria; `DEMO_SLOTS` fijo eliminado.
- `apps/mobile/src/AdminWorkspaceDemo.tsx`: selector de modalidad y edición de fecha/horas con validación visible, aviso de continuidad **solo posible**.
- `apps/mobile/App.tsx` y `apps/mobile/src/ui.tsx`: propagan el rango y la modalidad hasta las tarjetas de agenda y detalle.
- `apps/mobile/__tests__/AdminWorkspace.test.tsx`: teléfono/tablet, turno nocturno, cruces entre diferentes fechas, modalidad, formatos inválidos, 24h, continuidad, exclusión por profesional, datos sintéticos.

## Riesgos / exclusiones explícitas

- **Zona horaria:** el motor de demo expresa minutos civiles de calendario para simulación visual; no resuelve horarios ambiguos por cambios de hora. La programación **real** deberá usar un IANA timezone confirmado y el servidor PostgreSQL `timestamptz` / constraint GiST; el móvil nunca constituye fuente de autorización.
- **Relevos:** una coincidencia de horarios NO demuestra comunicación clínica ni conformidad del entrante. Para producir evidencia se requiere HC-02B RPC validada y posteriormente mecanismo de firma/identidad autorizado.
- **Planes y profesionales:** la demo no verifica matrícula, autorización médica, paciente real ni aprobación de cuidados; las operaciones de HC-02B siguen bloqueadas en episodios nuevos sin HC-02C.
- El documento original mensual escaneado requiere aún cotejo completo. La continuidad del cuidado **no depende** de un marcador visual.
- El código no se despliega a Supabase ni reemplaza planillas físicas del domicilio.

## Criterios de aceptación y certificación

- Jest: escenarios de fechas inexistentes, HH:mm inválidos, 24h, solapamientos de horas parciales y tipo cruzado, cruce de medianoche, límites contiguos, separación entre profesionales, candidatos a continuidad por mismo episodio.
- Quality Gate de CI: TypeScript strict, Jest UI, export JS para Android/iOS, Node contratos, PostgreSQL RLS, Deno JWT.
- GitHub-only: PR con diff acotado, cuatro jobs completos verdes y revisión de pasos sobre HEAD exacto, merge normal con `expected_head_sha`, push CI nuevamente exitoso en SHA de merge.

## Próximo gate exacto

**HC-02C:** definir y probar admisión/alta clínica, autorización de planes y habilitación de profesionales responsables, con controles auditados y verificación de representación del cuidador; después HC-03C para constancias, consentimiento y firmas jurídicas, sin mezclar pruebas de firma táctil con validez digital.

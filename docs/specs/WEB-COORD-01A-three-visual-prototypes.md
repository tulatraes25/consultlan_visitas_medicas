# WEB-COORD-01A — Tres prototipos web con una agenda ficticia

**SPEC/Kiro — 2026-10-11** · Etapa UI sin backend ni pacientes, derivada de [WEB-COORD-01](WEB-COORD-01-coordination-console.md) y [ADR-004](../adr/ADR-004-benchmark-driven-homecare-platform.md).

## Justificación del gate

El usuario solicitó investigar GitHub y tomar las mejores ideas arquitectónicas antes de construir el sistema. Tras OSS-HC-ARCH-01 se seleccionaron patrones de Folk Care (episodios/agenda), CareShift (relevos y aprobaciones humanas), CommandCare (planificador visual, pero **no** su backend demo), Medplum/OpenMRS (frontera clínica) y CONSULTLAN (paleta). Esta etapa muestra opciones concretas para comparar. No copia código de esos proyectos.

## Contratos de diseño comprobables

- **Tres diseños materialmente diferentes**: A (institucional con tabla y menú), B (operativo con tablero por días + cola y nav superior), C (híbrido con métricas, calendario y alertas). Selector A/B/C mantiene módulo, filtro y día elegidos.
- **Fixture único e inventado:** 13 coberturas, 9 visitas, 4 guardias, 2 sin asignar, 1 relevo pendiente, 4 episodios y 5 profesionales ficticios. Solo códigos administrativos (EPI-101) y etiquetas abstractas (Profesional A). Sin identidades ni diagnósticos.
- **Noche y jornadas:** semana 12–18 de octubre de 2026, huso de demostración explícito America/Argentina/Buenos_Aires UTC−03. La misma guardia 20:00–08:00 se representa en ambos días, y el modo 24h solo muestra la sección de cada jornada.
- **Interacciones de prototipo:** A/B/C, Resumen/Agenda/Episodios/Profesionales/Relevos/Reportes, modo semana/24h, filtro por especialidad, selector de día, lectura de ficha modal. Acciones asistenciales y confirmaciones deshabilitadas.
- **Accesibilidad preliminar:** lang=es, botones y selectores nativos para teclado, etiquetas, aria-pressed, estado actual de navegación, diálogo nativo, foco visible, consulta responsive tablet. Estados indicados con texto además de color.
- **Aislamiento:** no fetch, API, PostgREST, credenciales, persistencia local, bibliotecas remotas ni enlaces externos. Dos formatos: fuente web simple y preview.html autocontenido para abrir sin dependencias.
- **Prohibido** vincular datos con Supabase o construir panel operativo real en este gate. Toda autorización clínica, cierre, validación o firma sigue bloqueada.

## Archivos

- apps/web-prototypes/scenario.js: datos y operaciones puras, incluyendo proyección diaria de intervalos.
- apps/web-prototypes/app.js: tres vistas y navegación, acciones de solo lectura.
- apps/web-prototypes/styles.css: sistema visual, variantes A/B/C y responsive.
- apps/web-prototypes/index.html: web estática modular.
- apps/web-prototypes/preview.html: **mismo código** empaquetado inline, portátil.
- apps/web-prototypes/README.md: modo de visualización y límites.
- test/web-coord-prototypes.test.mjs: pruebas sin dependencias extra.
- .github/workflows/quality-gate.yml: chequeo sintáctico JS; npm test incluye contratos de demo.
- README.md: navegación al artefacto.

## Comparación guiada

| Criterio | A | B | C | Cómo evaluarlo |
| --- | --- | --- | --- | --- |
| Identidad visual CONSULTLAN | Alta | Media | Alta | ¿Reconocible por equipo Pediatrics? |
| Detección de guardia nocturna sin asignar | Media | Alta | Alta | Encontrar COB-005 sin filtrar |
| Relevo que exige aprobación humana | Media | Alta | Alta | Ir a Relevos y ver REL-001 |
| Lectura de 13 coberturas | Alta | Alta | Alta | Contabilizar sin omitir turnos |
| Legibilidad administrativa | Alta | Media | Alta | Revisar estados y profesional en un vistazo |
| Escalado con más profesionales | Por estudiar | Por estudiar | Por estudiar | Benchmark posterior con cientos de coberturas |
| Privacidad de la agenda | Prototipo inerte | Prototipo inerte | Prototipo inerte | La protección verdadera es backend Edge + RLS |

**Recomendación técnica provisional:** **C, híbrida**. La aprobación final del diseño corresponde a Pediatrics/Coordinación, basada en tareas y prototipos.

## Verificación y estados

1. node --check sobre escenario/app, npm test incluyendo fixture y seguridad, y Quality Gate 4/4. PR en rama corta y merge normal sólo con CI verde.
2. Post-main push 4/4 confirma **código de prototipo certificado**.
3. **WEB-COORD-01A_VISUAL_REVIEW_PENDING** permanece hasta que Coordinación revise A/B/C y se complete verificación visual/interactiva en navegador real.
4. Próximo gate **WEB-COORD-01B:** definir sistema de componentes React con tokens accesibles según diseño escogido, arquitectura por funcionalidades y pruebas E2E, sin conectar datos reales.

Este trabajo no certifica la seguridad clínica, el sistema final de turnos, condiciones laborales, adecuación normativa ni el uso con menores. Supabase remoto sigue **NO-GO**.

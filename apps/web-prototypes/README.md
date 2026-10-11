# WEB-COORD-01A — Laboratorio visual de coordinación domiciliaria

Tres alternativas **navegables** del futuro panel web, diseñadas con un único escenario **100 % sintético**. No es la consola de producción: no tiene backend, pacientes reales, sesión, documentos ni permisos clínicos.

## Verlo en un navegador

1. Abrir [preview.html](preview.html) desde GitHub y pulsar **Download raw file / Descargar archivo sin procesar**.
2. Abrir el archivo descargado en Chrome, Edge, Firefox o Safari. Es **un solo HTML autocontenido**: no necesita instalar dependencias, Supabase ni servidor local.
3. Usar A/B/C arriba para comparar. Cambiar módulos, modo **Semana / 24 horas**, especialidad, jornada y abrir detalles de episodios ficticios.
4. Para desarrollo también se puede abrir [index.html](index.html) si se descargan en la misma carpeta scenario.js, app.js y styles.css.

**Sin acceso de red, sin fuentes externas, sin credenciales, sin almacenamiento local.** El preview no hace llamadas HTTP, no guarda formularios y no aprueba cambios. Los códigos EPI-101 y PRO-01 son inventados; nunca deben sustituirse por identidades de Pediatrics ni del programa domiciliario.

## Qué comparar

| Alternativa | Arquitectura visual | Cuándo ayuda | Limitación |
| --- | --- | --- | --- |
| **A — Institucional** | Menú CONSULTLAN + tabla clara de agenda y estados | Administración, revisión de listados, reportes | Menos expresiva para coordinar turnos que atraviesan la noche |
| **B — Operativa** | Navegación superior, tablero por siete días, cola de asignaciones | Coordinación intensiva y resolución de huecos | Puede hacerse densa con muchos casos |
| **C — Híbrida** | Identidad CONSULTLAN + tablero semanal/24h + alertas y métricas | Equilibrio para Coordinación y Dirección | Debe definirse jerarquía de alertas y permisos reales |

**C es preferencia técnica provisional**, no decisión aprobada por Pediatrics. Se requiere revisión funcional de Coordinación antes de construir la web real.

## Flujos demostrados sin servidor

- Visita corta y guardia nocturna continua en ambos días; reloj del servicio explícito America/Argentina/Buenos_Aires, UTC−03.
- Dos coberturas sin profesional confirmado y un relevo pendiente (no se inventa una asignación).
- Filtro por especialidad y cambio a jornada 24h, con tarjetas colocadas según el tramo real que atraviesa ese día.
- Secciones: Resumen, Agenda 24/7, Episodios, Profesionales, Relevos y Reportes.
- Detalle de episodio **solo con código ficticio y metadatos operativos**; aprobación de relevos deshabilitada.
- Comparación A/B/C sobre **la misma** colección de 13 coberturas, cuatro episodios y cinco profesionales.

## Garantías y límites de prueba

El comando node --test test/web-coord-prototypes.test.mjs verifica fixture, solapamiento de noches, filtros, estructura de A/B/C, sintaxis JavaScript, marcadores de accesibilidad y preview sin URLs externas. Quality Gate integra estas pruebas en npm test más syntax checks. **No es una prueba E2E en navegador real**, no equivale a accesibilidad WCAG auditada ni a autorización clínica. La revisión visual por Coordinación y automatización E2E se definirán antes de WEB-COORD-01B.

Arquitectura fuente: [OSS-HC-ARCH-01](../../docs/research/OSS-HC-ARCH-01-github-benchmark.md), [ADR-004](../../docs/adr/ADR-004-benchmark-driven-homecare-platform.md), [WEB-COORD-01](../../docs/specs/WEB-COORD-01-coordination-console.md).

## WEB-COORD-01B — Capturas verificadas en navegador real (GitHub Actions)

La demo sigue siendo exclusivamente sintética. Una prueba adicional ahora abre preview.html en **Chrome real**, verifica los tres estilos en escritorio/tablet (1440, 1024 y 768 px), cambio de día y especialidad, continuidad de una guardia nocturna, foco/teclado, cuadro de episodio y aprobación deshabilitada. Durante la prueba, **toda solicitud HTTP/HTTPS se bloquea** y cualquier error JavaScript causa fallo.

Las **capturas PNG** se adjuntan como artefacto del trabajo Browser QA for synthetic web A/B/C en **Actions → Quality Gate**. Esto permite comparar las tres pantallas sin instalar programas. No se cargan imágenes clínicas ni se conecta ninguna API.

El test de Chrome no es un estudio clínico ni una auditoría completa WCAG, y no verifica Safari/WebKit. La **elección A/B/C por Coordinación continúa pendiente** antes de construir apps/web React definitivo.

## WEB-COORD-01C — compatibilidad y accesibilidad automatizada

La suite CI amplía la validación con **Firefox y WebKit (motor de Safari)** en 1440/768 px, además de Chrome ya probado. Verifica vista A/B/C, guardia 20:00–08:00, filtros, cambios de día, aprobación de relevo deshabilitada, modal y cero peticiones HTTP. **axe-core 4.10.3** examina violaciones automáticas graves/críticas WCAG 2.1 A/AA de Agenda, Episodios y Relevos en las tres alternativas. Estos controles son automáticos: no reemplazan la revisión humana ni la prueba en dispositivos físicos.

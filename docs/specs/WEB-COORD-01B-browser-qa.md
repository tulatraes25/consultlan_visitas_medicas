# WEB-COORD-01B-QA — Pruebas reales del prototipo antes de seleccionar UI

**SPEC/Kiro — 2026-10-11 · issue #53 · sin pacientes ni backend.**

## Hallazgo

El prototipo anterior se validaba con tests Node que simulaban eventos y buscaban estructura HTML, pero **no cargaban la página en un motor de navegador real**. Podían pasar pese a fallas de layout, bloqueo de controles, errores JavaScript de la interfaz real, o inaccesibilidad en tablet. Para que el usuario pueda seleccionar entre A/B/C con confianza, necesitamos evidencia de navegabilidad y capturas.

## Objetivo y alcance

- Mantener tres prototipos iguales en datos, sin agregar operaciones clínicas ni backend.
- Usar Playwright con Chrome de GitHub Actions para verificar funcionamiento de preview.html por URI file://, sin servidor.
- **Bloquear toda solicitud externa HTTP/HTTPS**; nunca exponer información sanitaria.
- Cubrir escritorio **1440×900** y tablets **1024×768**, **768×1024**, con scroll horizontal limitado al calendario y sin scroll horizontal del documento.
- Probar cambio A/B/C y aria-pressed, navegar con teclado hasta B, abrir modo 24 horas tras elegir día, continuidad de guardia nocturna, filtro, episodios y modal con Escape; acciones de aprobación clínica deben estar deshabilitadas.
- No admitir errores JavaScript ni excepciones de consola.
- Adjuntar capturas PNG de A/B/C en 1440 y C en 1024/768 para revisión de Coordinación, sin datos reales ni credenciales.
- CI revisa **cinco trabajos** (contratos/privacidad, Expo, RLS PostgreSQL, Edge/Deno y navegador). Si falla alguno, no se hace merge. Tras merge, revisar nuevo push sobre main.

## Implementación

- test/web-browser.e2e.cjs: suite real Playwright/CJS y capturas, sin dependencias permanentes del runtime.
- .github/workflows/quality-gate.yml: quinto job Chrome con Playwright 1.56.1 fijado; capturas adjuntas como artefacto 14 días.
- apps/web-prototypes/README.md: instrucciones sencillas de visualización y evidencia.
- README.md: entrada a esta SPEC.

## Límites y NO-GO

Las pruebas automatizadas de un navegador no equivalen a accesibilidad WCAG auditada, revisión visual humana ni seguridad médica. Safari/WebKit, contraste manual, revisión de terminología y selección del diseño por Pediatrics permanecen pendientes. **No se implementa aún apps/web definitivo ni acceso a pacientes**; no se usan otros servidores ni módulos de CONSULTLAN ambulatorio.

**Siguiente gate exacto:** revisión de capturas por Coordinación, registrar elección A/B/C y comenzar WEB-COORD-01B-React solo tras aprobar la arquitectura visual. STAGING-01F-REMOTE conserva su NO-GO hasta un Supabase autónomo con autorizaciones y actores sintéticos.

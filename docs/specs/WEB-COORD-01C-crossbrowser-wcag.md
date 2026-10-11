# WEB-COORD-01C — Compatibilidad multipantalla y auditoría accesible

**SPEC/Kiro · 2026-10-11 · fase previa a elegir A/B/C**.

## Problema

La fase WEB-COORD-01B-QA pasó Chrome 154 (1440, 1024 y 768 px) pero no verificó otros motores ni incumplimientos detectables WCAG 2.1 AA. Un diseño clínico operativo debe permitir navegación por teclado, lectura accesible y representación clara de guardias nocturnas. Las decisiones de interfaz continúan pendientes de revisión funcional por Pediatrics.

## Requisitos verificables

1. Ejecutar desde `preview.html` **sin backend** dos motores adicionales: Firefox y WebKit, correspondientes a una aproximación de escritorio a Firefox/Safari; 1440×900 y 768×1024. Conservar el Chrome QA existente.
2. Validar A/B/C, sus controles de navegación, la semana con 13 coberturas y solapamiento del relevo nocturno en dos días; filtro Enfermería, selección de jornada, modal de episodio ficticio con Escape, aprobación de relevos permanentemente deshabilitada y ausencia de scroll horizontal global.
3. Negar toda solicitud HTTP o HTTPS; no capturar ni enviar identificadores sensibles, usuarios, tokens, formularios ni datos reales.
4. Incorporar `axe-core 4.10.3` como dependencia transitoria **solo en CI**, ejecutada localmente, para verificar etiquetas WCAG 2.1 A/AA y bloquear violaciones **serias o críticas** en Agenda, Episodios y Relevos de A/B/C sobre 1440/768 px. Registrar detalles de regla, control y falla para corregir causa raíz.
5. No pasar si existe error JS, control inaccesible o documento con desplazamiento horizontal fuera de contenedores pensados para tablas/calendario. Prohibidas excepciones globales para silenciar fallos.
6. Dejar sin cambios Supabase/Edge/PostgreSQL, permisos y datos. Ejecutar los cinco jobs existentes más estas pruebas dentro del trabajo browser QA.

## Riesgos y decisiones

- Navegadores automatizados Linux no equivalen a Safari real en macOS ni a prueba con lectores de pantalla o teclados específicos.
- Un chequeo automático no puede acreditar conformidad WCAG completa; queda pendiente inspección manual y selección del estilo por Coordinación.
- Si las pruebas muestran fallas reales del prototipo, resolverlas en la misma rama mediante código GitHub y repetir el Quality Gate. No hacer pasar tests ignorando incidentes.
- Dependencias Playwright/axe-core se instalan sin persistir paquetes en la aplicación clínica. La demo `preview.html` continúa autocontenida.

## Criterio de cierre técnico

Candidato SHA exacto, PR Quality Gate 5/5, merge normal, post-main 5/5. La selección A/B/C sigue **PENDING** y no autoriza construir el producto clínico ni conectar un Supabase remoto.

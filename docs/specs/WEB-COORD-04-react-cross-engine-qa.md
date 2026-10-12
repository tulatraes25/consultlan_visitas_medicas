# WEB-COORD-04 — Consola React: QA de navegador real, móvil y accesibilidad

**SPEC/Kiro · 2026-10-12 · QA sobre candidato C sintético**

## Objetivo
No declarar utilizable el candidato React de Coordinación por compilar en TypeScript y verse en Chrome de escritorio. La consola debe permitir navegar y comprender horarios de visitas/guardias en navegadores comunes y anchuras reducidas, sin abandonar el modo desconectado.

## Criterios de aceptación
1. Construir `apps/web/dist/preview.html` autónomo, sin recursos remotos ni credenciales.
2. Probar navegación, filtros, continuidad de una guardia que cruza medianoche, diálogo y estados bloqueados en Chrome 1440×900, 768×1024, 390×844 y 320×720 px.
3. Repetir interacción real en Firefox y Safari/WebKit 768×1024 y 390×844; no confundir dos tarjetas visuales de un turno nocturno con dos prestaciones.
4. Cada anchura debe evitar desplazamiento **horizontal del documento** (se permite scroll contenido en la grilla semanal), excepciones JavaScript, botones clínicos habilitados o solicitudes HTTP.
5. Ejecutar `axe-core` WCAG 2/2.1 A/AA en Chrome 1440 y 390 px para Agenda, Episodios, Relevos, Reportes y Resumen; cero violaciones críticas/graves.
6. Capturas PNG de cada motor y tamaño en artifact QA para personas sin conocimientos técnicos.
7. Mantener los cinco trabajos del Quality Gate, merge normal y prueba posterior de main.

## Restricciones
Solo son datos sintéticos. El motor de navegadores no acredita permisos reales, elección institucional del diseño, validación de planillas originales, soporte offline clínico ni funcionamiento contra Supabase. No habilitar ningún endpoint o estado de atención.

## Bloqueos externos
Permanece sin elegir institucionalmente la propuesta C definitiva y sin staging Supabase autónomo autorizado. `WEB-COORD-04` es certificación de presentación, no aceptación funcional para atención domiciliaria.

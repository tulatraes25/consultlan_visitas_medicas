# WEB-COORD-03 — Alertas descriptivas derivadas de coberturas

**SPEC/Kiro · 2026-10-12 · GitHub-first · exclusivamente datos sintéticos**

## Problema
WEB-COORD-02 mostraba tres avisos de coordinación escritos a mano. Si las coberturas cambiaban, esos textos podían quedar desactualizados y aparentar decisiones humanas no realizadas.

## Requisitos
- Derivar avisos exclusivamente de `COVERAGES`, sin solicitudes de red, `Auth`, pacientes reales ni persistencia.
- Una prestación con `professionalId === null` genera un aviso de asignación pendiente. Una prestación asignada con estado `Relevo pendiente` genera un aviso de confirmación de relevo pendiente.
- El orden debe seguir el instante de inicio real; una guardia que atraviesa medianoche es una sola prestación y origina **un solo aviso**.
- Nunca inferir cobertura efectiva, pase de guardia acreditado, aprobación clínica, ausencia clínica o soluciones a conflictos solo a partir de cercanía de horarios.
- La interfaz debe explicitar que las acciones son humanas y que las coberturas son ficticias.

## Diseño
La función pura `deriveCoordinationAlerts(coverages)` prepara modelos descriptivos usando un objeto de cobertura por alerta. `apps/web/src/App.tsx` renderiza esa proyección, manteniendo la consola aislada del servidor. Se conserva el resumen de 13 coberturas y los botones de cambio y aprobación deshabilitados.

## Aceptación
- Navegador Chrome del bundle offline: exactamente **tres** alertas distintas, ordenadas COB-003, COB-005, COB-007.
- Guardia COB-005 mostrada como finalización al día siguiente y sin duplicación.
- Una guardia confirmada COB-008 no debe recibir alerta.
- Conservación de todas las pruebas existentes: Quality Gate de cinco jobs y cero tráfico saliente.
- Tras PR exitoso, merge normal y CI post-main antes de certificar.

## Límites
**NO-GO pacientes reales.** La tabla de coberturas es sintética, no reemplaza la revisión del plan de atención ni una validación de continuidad clínica, y no se conecta a Supabase. Cotejo de planillas privadas, decisión institucional de diseño y staging exclusivo siguen pendientes.

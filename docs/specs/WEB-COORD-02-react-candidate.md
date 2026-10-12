# WEB-COORD-02 — Consola de coordinación React (candidato C)

**SPEC/Kiro · 2026-10-12 · candidato sintético offline · issue #53**

## Problema
Los tres prototipos anteriores A/B/C están validados en navegadores, pero consisten en un único archivo de renderización imperativa: no constituyen una base de componentes para la consola web definitiva. El usuario final necesita ver un sistema reconocible y sencillo, no instalar un programa ni comprender código. La opción **C/híbrida** es la preferencia técnica provisional, no una decisión formal de Pediatrics/Coordinación.

## Objetivo
Crear un candidato React+TypeScript seguro, modular y sin dependencia de red que presente las **mismas trece coberturas sintéticas** que A/B/C y permita validar la estructura de la navegación antes de elegir sistema de componentes definitivo.

## Restricciones de alcance
- **Sin Supabase real**: nunca importar claves, SDK, Auth o usar PostgREST/Edge. Sin datos de pacientes.
- **Sin acciones clínicas**: no comenzar/cerrar visitas, aprobar relevos, emitir planillas, capturar firmas, mandar alertas ni exportar rendiciones.
- No copiar una base de otra aplicación ni integrarse con pacientes ambulatorios de CONSULTLAN.
- Información sintética: cuatro episodios, cinco profesionales ficticios, trece prestaciones, dos sin profesional, una con relevo pendiente; guardia 20:00–08:00 visible ambos días sin duplicarla en los conteos.
- UX de coordinación en escritorio y tablet, accesible sin programación: un **HTML autocontenido** generado en CI, abrible por doble clic.

## Diseño
`apps/web/src/data.ts` es una capa temporal de fixtures y proyecciones puras. `src/App.tsx` contiene componentes para indicadores, agenda, tarjetas, episodios, equipo, relevos, reportes y modal; el código podrá separarse en submódulos cuando se elija el diseño. `src/styles.css` comparte **solo identidad visual** CONSULTLAN verde; utiliza controles nativos y contrastes revisables. `scripts/emit-standalone.mjs` empaqueta exclusivamente JS y CSS estáticos generados en una vista HTML offline. `apps/web/README.md` proporciona guía para personal sin conocimientos técnicos.

## Aceptación
1. `npm run build` en apps/web pasa TypeScript estricto, Vite y emite `dist/preview.html` autónomo sin peticiones externas.
2. Las siete columnas incluyen continuaciones nocturnas y los totales permanecen 13/9/4/2/1/4, sin considerar la duplicación visual como una visita más.
3. Chrome 1440×900 y 768×1024 pasan navegación por módulos, filtros y fecha, cierre con Escape del detalle, rechazos vacíos, botones de aprobación/rendición deshabilitados, sin errores JS, ni scroll horizontal del documento ni peticiones HTTP.
4. CI ejecuta cinco trabajos preexistentes; un fallo de compilación/contrato/UI bloquea el merge, y tras merge se certifica el CI de `main`.
5. Preview y capturas (escritorio/tablet) quedan en artefacto temporal de GitHub Actions; sin datos reales ni código operativo de Supabase.
6. **Revisión humana sigue pendiente**: capturas A/B/C anteriores y candidato React C deben ser evaluados por Coordinación/Pediatrics; no interpretar esta implementación como elección formal del diseño.

## Siguiente dependencia
La consola definitiva y la integración con un Supabase independiente necesitan elección formal de UX, matriz de permisos por coordinación/rol, aprobaciones institucionales para staging sintético y pruebas de seguridad remotas STAGING-01F. Documentos originales privados continúan bloqueados en #57. No habilitar producción ni subir PHI.

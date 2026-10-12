# HC-UX-03A — Matriz bloqueante para cotejar fuentes privadas

**SPEC/Kiro · 2026-10-11 · issue #57 · NON_CLINICAL_READ_ONLY**

## Decisión y hallazgo

El proyecto ya tiene un catálogo fiel **a las estructuras verificadas** de seis planillas de asistencia, una hoja de evolución y cuatro hojas que deben permanecer en papel. La demostración de HC-UX-02 mostraba una planilla de ejemplo, pero todavía podía confundirse un borrador con una reproducción certificada del original.

Los DOCX originales y el expediente escaneado de 56 páginas no se encuentran disponibles como originales verificables en la fuente pública del repositorio ni en los archivos accesibles del proyecto actual. **No afirmar equivalencia visual ni legal con documentos no cotejados.** No subir jamás pacientes, firmas, sellos originales, scans, rutas privadas o comprobantes reales a GitHub.

## Meta del producto

Desde la prestación domiciliaria asignada, el profesional debería obtener automáticamente el formulario correcto, sin navegar entre documentos ni repetir datos. Coordinación y Administración necesitan saber **qué comprobantes están completos, qué requiere firma/revisión y qué falta conciliar con el expediente mensual**, pero sin declarar validación clínica cuando hay un borrador.

## Implementación de este subgate

- `src/domain/homecare-source-review.mjs` deriva la matriz desde `src/domain/homecare-form-contracts.mjs`: **7 contratos**, **4 referencias `PAPER_ONLY`**, **1 referencia `MONTHLY_DOSSIER`**. Cada documento digitalizable exhibe chequeos obligatorios de diseño/fila, copias, firmante/representación, profesional, financiación y aprobación médica/administrativa. Las hojas de papel tienen otro circuito de custodia sin digitalización automática.
- `comparePrivateSourceFieldIds({templateId,observedHeaderIds,observedRowIds})` comprueba exclusivamente **IDs de campos**, no etiquetas libres. Rechaza campos desconocidos, duplicados, formatos inválidos y **propiedades adicionales** (identidad, clínica, imágenes de firmas, aprobaciones). Igualdad de IDs implica **solo un autocontrol estructural declarado por quien compara**, nunca certifica haber visto el original ni autoriza PDFs.
- `inspectMonthlyDocumentGate()` entrega siempre `BLOCKED_PRIVATE_SOURCE_REVIEW`, `emittedDocuments=0`, `canEmit=false` y motivos concretos. Las **56 páginas son del ejemplo recibido**, **no** la cantidad final exigida por el financiador.
- `apps/form-prototypes/preview.html` incorpora una tarjeta sencilla de **qué falta para la documentación real** al abrir Expediente mensual, con una lista desplegable de siete planillas pendientes. Se genera usando el mismo catálogo HC-03A y la matriz inmutable; sigue sin red, sin persistencia, sin formularios, sin pacientes y sin firmas.
- `test/homecare-source-review.test.mjs` comprueba fidelidad, inmutabilidad, todos los estados bloqueados y rechazo estricto de payloads sensibles. `test/hc-ux02-browser.e2e.cjs` verifica en **1440/768/390 px** la nueva tarjeta, las siete pendientes, cuatro PAPEL, ausencia de errores JS y solicitudes HTTP. CI conserva los cinco jobs (contratos, PostgreSQL RLS, Deno Edge, Android/iOS Expo, navegador Firefox/WebKit/Chrome).

## Pendientes que este subgate NO sustituye

- Comparación **privada y visual, documento por documento**, con los originales DOCX y el PDF mensual escaneado completo, incluidos duplicados, celdas, disposición, logos, firmas, márgenes y layout.
- Verificación de la definición de prestación válida, si existe una o dos tablas de un mismo original y cómo se registran guardias que cruzan medianoche.
- Acuerdo con Dirección Médica, Coordinación, Administración y obras sociales sobre evidencia, responsables autorizados, firma electrónica/digital según legislación vigente, fechas y tiempos, custodia y rectificaciones.
- Aprobación del orden del expediente mensual, foliado, anexos físicos y plazo de conservación.
- Implementación del circuito de aprobación de episodios/planes HC-02C, firma legítima, documentos privados versionados y almacenamiento aislado en el Supabase autónomo.
- Ni la matriz ni los tests pueden autorizar pacientes reales, prescribir tratamientos, capturar firmas, emitir un PDF clínico, garantizar WCAG completo o cerrar un expediente.

## Condiciones de aceptación

1. Matriz 7 + 4 + 1 siempre marcada NO-GO, con campos derivados del contrato fuente y cero PHI.
2. La comparación de IDs no filtra contenido desconocido y no acepta nombres/rutas/firmas.
3. El ejemplo de 56 páginas no se impone como requisito universal.
4. UI intuitiva en celular, tablet y escritorio; el circuito de tres pasos de HC-UX-02 permanece intacto.
5. PR CI **5/5 PASS**, merge normal y posterior `main` CI **5/5 PASS** antes de `CLOSED_CERTIFIED`.

**Próximo gate HC-UX-03B:** validación privada del original de cada plantilla y las 56 páginas; solo luego proceder a una especificación de documentos emitibles, de las firmas y de la custodia. Mantener #57 ABIERTO.

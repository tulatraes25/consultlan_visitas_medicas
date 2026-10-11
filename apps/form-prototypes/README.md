# Pediatrics · Demostración de planillas para profesionales

Este es un prototipo para **ver el recorrido que realizaría un profesional por primera vez**. Es una página HTML independiente: no hay cuentas, servidor, base de datos, firma ni datos clínicos reales.

## Para abrirlo, sin programar

1. Abrí el archivo [preview.html](preview.html) en GitHub.
2. Tocá el ícono de descarga (`Download raw file`).
3. Buscá el archivo descargado en **Descargas** y hacé doble clic.
4. Se abrirá en tu navegador. Elegí una profesión de prueba y tocá **Abrir mi prestación → Ver borrador de la planilla**.
5. Entrá en **Mis planillas** y **Expediente mensual** para ver la separación entre constancias, evolución y hojas que permanecen en papel.

La profesión es intercambiable **solo para evaluar el diseño**. En el futuro sistema autenticado no se elegirá libremente: depende del profesional habilitado y su prestación asignada.

## Cuál es la fuente de los campos

El catálogo se extrajo literalmente de `apps/mobile/src/formPreviewCatalog.json`, que coincide con `src/domain/homecare-form-contracts.mjs`. Las pruebas de paridad fallan si se agrega, elimina o modifica alguno de los campos verificados en el inventario `FORM-001` sin actualizar el contrato.

| Fuente | Uso del prototipo |
| --- | --- |
| Medicina, Enfermería/Cuidadoras, Kinesiología, Fonoaudiología, Terapia ocupacional, Nutrición | Seis constancias separadas con campos y encabezados del inventario |
| Hoja de evolución | Modelo separado, **sin texto clínico real** |
| Kardex, signos vitales, control procedimientos, crisis | Cuatro referencias a documentos físicos, no digitalizados |
| Expediente mensual original, 56 páginas | Una referencia documental sin reconstrucción ni paginado definitivo |

El PDF mensual original **no está transcrito integralmente**. El prototipo NO reproduce su diseño exacto ni incorpora escaneos, firmas o datos privados. Toda salida sigue etiquetada **DEMO SIN VALIDEZ / NO EMITIDO**; no se puede guardar ni certificar una atención.

## Calidad y alcance

Las pruebas Node verifican igualdad de los campos contra el catálogo y el contrato fuente, ausencia de captura clínica y bloqueo de documentos físicos. El trabajo de navegador CI abre el archivo real en Chrome en **1440 / 768 / 390 px**, prueba todas las especialidades, evolución, expediente, no desbordamiento y cero peticiones HTTP externas. Los PNG y el HTML de demostración están disponibles en los artefactos del Quality Gate.

Todavía falta validación funcional por Pediatrics, cotejo visual con los DOCX/PDF originales privados, condiciones de firma y emisión y aprobación del expediente mensual. **No** sustituye las hojas físicas, ni las indicaciones médicas, ni habilita pacientes.

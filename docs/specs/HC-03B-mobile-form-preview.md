# HC-03B — Previsualización móvil de planillas de internación domiciliaria

**Fecha:** 2026-10-10 · **Estado:** GitHub-first, pendiente certificación PR / post-main.

## Contexto y fuente rectora

Pediatrics solicitó una app para profesionales de su **programa de internación domiciliaria**, independiente del consultorio y de sus pacientes ambulatorios. La infraestructura se construye desde cero en un Supabase propio; solo se toma el lenguaje visual de CONSULTLAN.

Los archivos entregados por Pediatrics son autoridad funcional de las planillas: [FORM-001](FORM-001-inventario-clinico.md) y [HC-03A](HC-03A-source-form-contracts.md). Aún no existe transcripción completa ni aprobación clínica del PDF escaneado de 56 páginas. Ningún contenido de pacientes o firmas originales se incorpora al repositorio.

## Objetivos / Requisitos

R1. Incorporar pestaña **Planillas** en teléfonos (barra inferior) y tablets (menú lateral) sin romper Inicio, Agenda, Detalle, Gestión ni la ventana de firma exclusivamente ficticia preexistente.

R2. Mostrar **seis planillas de asistencia por especialidad**: Medicina, Enfermería/cuidadoras, Kinesiología, Fonoaudiología, Terapia ocupacional y Nutrición; añadir **Evolución** en grupo separado de asistencia.

R3. La sección **Hojas en domicilio** contiene solo referencias al Kardex, signos vitales, control de procedimientos y hoja de crisis. No presentar valores clínicos, umbrales de emergencia, instrucciones terapéuticas ni formularios digitales para estos documentos.

R4. Las previsualizaciones muestran **solo rótulos de los campos originales y marcadores informativos no editables**. Identificar por separado profesional y familiar/tutor, sin botón de firmar, enviar o cerrar. Los datos de contexto del episodio se indican como no disponibles hasta autorización real.

R5. Desde la visita de demostración, navegar a la planilla de su especialidad **pasando únicamente un identificador de especialidad**, sin nombre, DNI, episodio, narrativas ni domicilio del supuesto paciente.

R6. Responsive: lista→detalle con volver en móvil/tablet intermedia; lista y detalle juntos en tablet ancha (umbral 1180 dp, condicionado a resolución completa), con áreas pulsables de al menos 44 dp y etiquetas accesibles.

R7. Rechazar divergencia de campos con la fuente: `apps/mobile/src/formPreviewCatalog.json` es una **proyección solo visual** de los siete contratos verificados por `src/domain/homecare-form-contracts.mjs`. CI compara campos, tipos, especialidad, fuentes y los cuatro documentos en papel; no se permite incorporar un rótulo sin actualizar y revisar el contrato de origen.

## Implementación

- `apps/mobile/src/FormCatalogDemo.tsx`: selector interactivo por grupo y especialidad, vistas únicamente informativas, avisos de no captura/firma, referencias en papel y navegación accesible.
- `apps/mobile/src/formPreviewCatalog.json`: proyección sin ninguna información identificable ni imágenes.
- `apps/mobile/App.tsx`: nueva pestaña `Planillas`, con apertura opcional contextual desde el detalle de una visita ficticia pasando **solo especialidad**.
- `test/homecare-mobile-preview-parity.test.mjs`: prueba Node de igualdad con fuente clínica estructural.
- `apps/mobile/__tests__/FormCatalogDemo.test.tsx`: recorridos en teléfono/tablet, distinción evolución/constancia/papel, ausencia de campos clínicos editables y ruta contextual privada.

## Exclusiones de seguridad

NO hay escritura Supabase, pacientes reales, historial clínico, autenticación, captura de firmas de responsables, firma digital profesional, generación de PDFs médicos o comprobantes habilitados. Los marcadores "firma pendiente" no son firmas ni evidencias. No agregar nunca datos ficticios que se parezcan a personas reales.

La ventana de **firma táctil de demostración anterior** permanece aislada en el detalle de visita y descarta sus trazos al cerrar. Esta pantalla nueva de planillas NO abre esa ventana ni copia trazos.

El material en el domicilio **no se sustituye** por la app. La estructura del dossier mensual permanece referencia pendiente de cotejo y autorización institucional.

## Criterios de aceptación / Quality Gate

1. **Node:** contratos móviles = contratos fuente en exactamente 7 formularios y 4 referencias físicas; cualquier campo introducido fuera de la fuente rompe el CI.
2. **Jest:** teléfono 390 dp, tablet 1000 dp y tablet 1280 dp, navegación entre pestañas, selector por profesión, papel, evolución y volver, sin botones clínicos ni TextInput de datos sanitarios.
3. Mantener intactos los gates PostgreSQL RLS HC-01/02, Deno Edge HC-02B, TS strict, export JavaScript Android/iOS.
4. Revisar diff acotado, PR CI verde en HEAD exacto, merge normal y push CI verde sobre SHA del merge.

La exportación JS Android/iOS no es todavía APK/IPA instalable ni validación en equipo físico.

## Siguiente paso

**HC-03C:** diseñar el documento de constancia por prestación/turno con evidencias de identidad y representación, consentimiento y firmas electrónicas/digitales diferenciadas, validación de flujos por Dirección Médica y área administrativa; realizar implementación de evidencias firmadas solo luego de aprobar legalidad, privacidad, retención, inmutabilidad y HC-02C (autorización clínica).

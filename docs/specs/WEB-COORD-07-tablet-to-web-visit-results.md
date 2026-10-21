# WEB-COORD-07 — Resultados registrados en tablets, consultables desde una web

**SPEC/Kiro · 2026-10-21 · candidato de demostración 100% offline**

## Necesidad aprobada
Los profesionales de internación domiciliaria utilizarán principalmente tablets para sus prestaciones, evoluciones, constancias y captura táctil de trazos. **Después de registrar la visita, Coordinación deberá consultar los resultados desde una web**, sin depender de que la historia clínica física permanezca en el domicilio.

Esto exige dos experiencias separadas pero integradas en el futuro:

- **Tablet profesional:** seleccionar únicamente una prestación propia autorizada, cargar la evolución correspondiente a la especialidad, registrar fecha y hora, verificar integridad y seguir un proceso válido de firmas/constancias.
- **Web de Coordinación:** consultar resultados autorizados por episodio, fecha, profesional y especialidad; revisar faltantes, correcciones y firmas; preparar el expediente mensual únicamente con permisos y validaciones del servidor.

## Implementación actual (sin Supabase)
La consola React incorpora la sección **Resultados de visitas**, con:
1. Un esquema visual Tablet → Servidor seguro → Web de Coordinación, marcado **SIN SINCRONIZACIÓN**.
2. Ocho resultados **inventados y solo de lectura**, asociados exclusivamente a los ocho registros documentales ficticios ya presentes en WEB-COORD-05. No se deducen prestaciones realizadas de citas programadas.
3. Título de la evolución, valores ilustrativos específicos de especialidad, fecha de prestación distinta de la fecha de carga, profesional identificado únicamente por código ficticio y estado documental obtenido del mismo modelo puro que utiliza Control documental.
4. Filtros por episodio, especialidad y observaciones; detalle expandible y navegación a Control documental con retorno sencillo.
5. **Solo una fila por documento**, incluso cuando el turno corresponde a una guardia nocturna que se muestra en dos días del calendario.
6. Un registro con papel pendiente de escaneo no inventa el contenido clínico que aún no está disponible.
7. Sin cargar, guardar, enviar, descargar, aprobar, firmar o cerrar nada. La práctica de firma táctil de WEB-COORD-06 jamás modifica estados del expediente.
8. Compatibilidad 320/390/768/1440 px, navegación con teclado, lectura responsiva y sin HTTP, almacenamiento local ni acceso a un servidor.

## Contrato para la futura integración real (NO implementado)
- Supabase **independiente del consultorio ambulatorio**, con organizaciones totalmente aisladas, identidad autenticada, roles y verificación en el servidor.
- Toda consulta web de resultados debe ser filtrada por **organización autorizada y permisos de acceso clínico**, nunca solo por un filtro de interfaz. Prohibido un endpoint global que entregue todas las historias.
- Vincular cada evolución al episodio, profesional, cobertura y versión de plan autorizados. Una agenda o una captura de trazo no es evidencia de que se realizó atención.
- Registrar por separado el momento de prestación, la hora confiable de carga en servidor, la identidad del autor y la versión documental. Correcciones posteriores mediante adendas trazables, sin sobreescribir el original.
- Firmas profesionales y constancias del representante en flujos y controles jurídicos distintos; los trazos visuales **no bastan** para certificar una firma digital argentina.
- Historia visible solamente a destinatarios legalmente autorizados. Mantener derechos de acceso y entrega del paciente o representante legitimado.
- Denegación ante tokens vencidos/revocados, organizaciones cruzadas y accesos sin pertenencia; pruebas de dos organizaciones ficticias en staging y auditoría de lectura/escritura.
- Exportación/PDF y cierre mensual recién después del cotejo privado de plantillas, aceptación de Laura/Pediatrics, validaciones y controles institucionales.

## Pruebas exigidas
- React se compila a archivo HTML autónomo.
- E2E Chrome 1440/768/390/320, Firefox/WebKit 768/390: 8 resultados, 5 observados y 3 sin observaciones de ejemplo, documentos nocturnos únicos, fecha de carga distinta de prestación, notas expandidas sin papel no escaneado, filtros y navegación Control documental → Resultados.
- Cero solicitudes HTTP, cero excepciones de navegador, cero controles habilitados para emitir historias. Axe-core sin violaciones WCAG A/AA graves/críticas en la nueva sección.
- Quality Gate GitHub 5/5 antes del merge normal y Quality Gate posterior al merge sobre SHA de `main`.

**Estado:** listo para presentar visualmente a Pediatrics; **NO** existe transferencia real entre tablets y web, y no se habilitan historias clínicas ni pacientes reales.

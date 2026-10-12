# Pediatrics Visitas — aplicación móvil (DEMO)

**Scope:** navegación de muestra para teléfono y tablet. **No habilita prestaciones reales.** La arquitectura decidida para la aplicación operativa es un Supabase independiente, sin conexión con Pediatrics/CONSULTLAN; esta demo aún no se conecta a Supabase.
**Datos:** seis registros iniciales completamente sintéticos, más coberturas VISIT o SHIFT creadas en memoria durante la sesión. No almacena ni envía información personal.

## Stack
Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript estricto. Dependencias verificadas contra el template `expo/expo` rama `sdk-57` el 2026-10-10. El PINNING de dependencias transitivas mediante package-lock y EAS device builds permanece como gate previo a prueba de usuarios reales.

## Ejecutar localmente (entorno de desarrollo)
```bash
cd apps/mobile
npm install
npm run typecheck
npm start
```
Usar el emulador/dispositivo compatible con Expo SDK 57. Para producir bundles en GitHub CI se ejecuta `expo export` para Android e iOS; **el bundle no equivale a una app instalable APK/IPA**.

## Pantallas incluidas
1. Inicio: jornada, métricas ilustrativas y dos próximas visitas.
2. Agenda: búsqueda local y filtros por estado.
3. Detalle: prestación ficticia y explicación del circuito de documentación y firmas.
4. Adaptación: navegación inferior en teléfonos; barra lateral desde 900 dp; panel lateral de detalle solo a partir de 1180 dp, con detalle a pantalla completa en tamaños intermedios.
5. Ventana táctil de firma (simulación): trazo con dedo o lápiz, borrar y descartar. No guarda, transmite ni autentica firmas.
6. Gestión administrativa simulada: pacientes/profesionales ficticios, elección de modalidad **Visita puntual / Guardia prolongada**, fecha y rango HH:mm variable, incluso guardias de hasta 24 horas que cruzan medianoche; se rechazan superposiciones del mismo profesional y se muestran **posibles continuidades**, nunca como relevos acreditados. No crea cuentas ni persiste datos.
7. **Planillas (HC-03B)**: catálogo por seis especialidades y hoja de evolución; previsualiza campos originales confirmados, sin campos de captura ni firmas. Lista→detalle en celulares/tablets medianas y dos paneles en tablet ancha. Desde una visita ficticia se abre la plantilla de su especialidad **sin enviar datos del paciente**.
8. **Hojas en domicilio**: Kardex, signos vitales, procedimientos y hoja de crisis figuran únicamente como referencias físicas; no son formularios editables ni sistemas de alarmas.
9. **Episodios (MOB-HC-EPISODE-01)**: dentro de Gestión, lista de episodios inventados y agenda VISIT/SHIFT agrupada por episodio y paciente; sin admisión ni plan aprobados, y sin mezcla de casos.
10. **Continuidades de guardia (MOB-HC-HANDOVER-01)**: vista informativa de turnos SHIFT consecutivos y profesionales ficticios distintos, siempre del **mismo paciente y episodio**. Mensaje visible «SIN RELEVO ACREDITADO»; no se acepta, firma ni transmite información clínica.
11. **Profesionales vinculados a coberturas de muestra (MOB-HC-TEAM-01)**: muestra especialidad y cantidades VISIT/SHIFT por profesional sintético solo del episodio seleccionado, sin nombres proporcionados externamente. No representa un equipo asistencial habilitado.
12. **Borradores de planes de cuidados (MOB-HC-PLAN-01)**: metadatos DEMO de versión DRAFT y cantidad de versiones, siempre bajo el mismo paciente y episodio. Sin aprobación profesional, tratamientos, medicación, firma ni registros reales.
13. **Solicitudes de revisión coherentes (MOB-HC-REVIEW-02)**: cada solicitud pendiente DEMO aparece solo si existe una versión DRAFT válida del mismo paciente y episodio; no hay aprobación ni firma.
14. **Vista profesional de muestra (MOB-HC-PRO-01)**: seleccioná un profesional ficticio en Gestión → Vista profesional para consultar solo sus coberturas DEMO, ordenadas incluso con guardias nocturnas. El selector no autentica y nunca concede permisos clínicos.

## Suscripción segura de agenda a Auth (MOB-AUTH-01)

La pantalla `StagingOwnRosterPreview` exige un parámetro `authEvents` con contrato `onAuthStateChange` compatible con el SDK Supabase. Cada evento de Auth, incluso renovación de token e inicio de sesión, borra la agenda de memoria y cancela consultas en curso; el desmontaje elimina la suscripción. Una implementación real deberá proveer este contrato desde el **Supabase nuevo, separado** y nunca desde Pediatrics ambulatorio. Hasta probar STAGING-01F-REMOTE, el componente sigue sin montarse en `App.tsx` ni habilitar login o datos reales. [SPEC MOB-AUTH-01](../../docs/specs/MOB-AUTH-01-event-bound-roster.md).

## Integridad de coberturas del adaptador Edge (MOB-DATA-03)

El adaptador `readonlyCoverageClient.ts` rechaza fechas ISO imposibles y duplicados de UUID aunque difieran en mayúsculas. Esto evita presentar dos veces la misma cobertura o normalizar silenciosamente un 30 de febrero; conserva hasta 100 filas distintas, con aviso de posible truncamiento. Los fallos se expresan con códigos fijos y limpian la vista de staging sin exponer datos. Sigue sin conectarse a Supabase real y no ejecuta decisiones médicas. [SPEC MOB-DATA-03](../../docs/specs/MOB-DATA-03-coverage-integrity.md).

## Ciclo seguro de sesión para futura agenda real (MOB-DATA-02)

Los nuevos archivos `src/coverageSessionController.ts` y `src/StagingOwnRosterPreview.tsx` preparan la lectura de agenda propia en staging con cancelación de solicitudes y borrado inmediato al cerrar/cambiar sesión, cambiar de pantalla o enviar la app a segundo plano. Antes de mostrar resultados se vuelve a pedir el token de Auth: si cambió, se descarta la respuesta antigua. Una respuesta tardía que ignore el AbortSignal no puede sobrescribir el estado actual. La pantalla solo muestra modalidad, estado y horarios y **no está montada en App.tsx**: no existe todavía infraestructura Supabase de internación domiciliaria aprobada ni proveedor de autenticación conectado. La construcción y la apertura de la pantalla no provocan red; la lectura requiere interacción explícita y configuración institucional de staging. El integrador de Auth deberá invocar `clear()` inmediatamente al cambiar/cerrar sesión; la cancelación del cliente complementa, pero nunca sustituye, las validaciones Auth/Edge/RLS. [SPEC MOB-DATA-02](../../docs/specs/MOB-DATA-02-session-bound-roster.md).

## Adaptador de lectura futura (MOB-DATA-01)

El código `src/readonlyCoverageClient.ts` prepara una futura consulta **POST a una Edge Function con validación de sesión activa** en el Supabase autónomo, con llave publicable y JWT de usuario de Auth. **No está importado por las pantallas y no hace llamadas reales**. El backend **conserva HC-READ-01 como SQL histórico**; su acción Edge sin ventana quedó retirada en HC-READ-03 porque podría mostrar solo cien coberturas antiguas. La agenda futura usa exclusivamente HC-READ-02 paginado con ventana y Auth por página. **No existe un Supabase desplegado ni se permite usar pacientes reales**. HTTP 422 se rechaza explícitamente, jamás se convierte en agenda vacía. No realiza GET directos a PostgREST, que podrían aceptar un JWT luego de cerrar sesión. Los tests solo simulan respuestas. Las credenciales privilegiadas y la verificación real de permisos permanecen exclusivamente en el servidor; sin datos clínicos, firma ni pacientes reales.

## Límites y seguridad
- Se muestra siempre **MODO DEMO · datos ficticios**.
- La pestaña Gestión solo sirve para probar UX, **no es una ruta autenticada ni representa permisos reales**. Los códigos de personas son sintéticos de 1 a 4 caracteres. Los campos de fecha/hora únicamente representan calendario de simulación.
- Las futuras invitaciones a Supabase Auth y las altas clínicas reales no están conectadas a estos formularios.
- No hay autenticación, conexión a CONSULTLAN, historias clínicas, firma electrónica/digital válida ni guardado de documentos.
- La previsualización HC-03B utiliza `formPreviewCatalog.json`, cuya paridad exacta con HC-03A se comprueba mediante tests Node; **solo expone etiquetas de campos**, no datos, identificadores, imágenes ni valores clínicos.
- La vista de planillas no dispone de botones de enviar, guardar, prescribir, confirmar crisis o firmar.
- La prueba táctil usa trazos SVG **en memoria volátil**. Al cerrar el modal se desmonta el lienzo y se descartan sus trazos; no existe botón de enviar o firmar.
- La selección de vínculo familiar es ilustrativa y **no verifica identidad** ni autorización de cuidadores.
- El registro de asistencia del familiar y la firma digital certificada del profesional seguirán siendo documentos separados.
- Ninguna acción clínica se simula como aceptada o certificada.
- El motor horario de demostración utiliza **minutos civiles**, no comprueba transiciones DST ni determina el huso horario asistencial. En producción, servidor PostgreSQL con `timestamptz`, episodio aprobado, RLS y restricciones GiST seguirán siendo la única autoridad de programación.
- Dos turnos consecutivos pueden ilustrar continuidad, pero **nunca** un relevo clínico aceptado ni una transmisión segura de información.
- No publicar en stores ni conectar con API real desde este prototipo.
- Los colores provienen del sistema institucional: `#166534`, `#0B3D2A`, `#DDF5E6`.
- Próximos gates: HC-02C (aprobación/activación clínica con responsables habilitados), HC-03C (flujo seguro de evidencias y firmas), más staging Supabase independiente con RLS real y pruebas físicas. No introducir service_role ni otros secretos en el móvil.

## HC-READ-02B — Consulta paginada de staging, aislada de App

`pagedCoverageClient.ts` consulta solamente `listMyHomecareCoveragesPage` y `listMyHomecareCoveragesNextPage` sobre la Edge del proyecto Supabase **independiente**, con JWT de usuario obtenido al hacer la solicitud. Exige ventana UTC explícita máximo 32 días, cursor microsegundo + UUID, validación estricta de seis atributos por cobertura, orden, límites, duplicados y `hasMore`. No usa PostgREST directo, `service_role` ni AsyncStorage; actor/organización se verifican exclusivamente del lado del servidor.

`pagedCoverageController.ts` conserva únicamente datos en memoria, cancela operaciones vencidas, descarta todas las páginas ante cambio de Auth/ventana y exige una nueva lectura manual; cada página comprueba otra vez la sesión y no reutiliza tokens si cambiaron. Se limita a 2000 tarjetas en una misma consulta; si hay más registros se deberá reducir la ventana en un futuro staging autorizado. `StagingPagedRosterPreview.tsx` protege el primer render antes del enlace Auth, presenta timestamps en zona IANA explícita y permite cargar la siguiente página **solo con pulsación**.

**No está importado desde `App.tsx`**: todavía no existe Supabase remoto institucional autorizado ni usuarios reales de internación domiciliaria. Las pruebas son exclusivamente ficticias (100+5 filas, guardias, revocación y respuesta malformada). La interfaz no valida prestaciones, órdenes, firmas, consentimiento, urgencias ni completitud real. Un `hasMore=false` refleja únicamente esa consulta, no un snapshot consistente bajo cambios simultáneos.

## HC-UX-04A — una sola planilla desde la próxima prestación ficticia

La pantalla **Inicio** presenta **Abrir mi planilla (demo)** como acción principal. El botón identifica la primera cobertura pendiente **de la agenda sintética** ordenada por fecha/hora y muestra automáticamente la constancia de su especialidad en una pantalla enfocada. El profesional no necesita buscar entre seis planillas ni navegar antes por Gestión. El enlace secundario **Ver agenda completa** se conserva.

Desde el detalle de la agenda ficticia también se abre la planilla correspondiente en **modo enfocado**: no se ofrecen otras especialidades, hoja de evolución o registro físico para elegir accidentalmente. Se puede volver a la agenda con un botón; la pestaña independiente **Planillas** continúa presentando el catálogo completo para revisión educativa. El contenido de la planilla se toma de `formPreviewCatalog.json` (contrato HC-03A); **no hay captura ni emisión**.

**Seguridad del prototipo:** no hay un profesional autenticado. Los datos son sintéticos, la cobertura no equivale a una asignación real y ninguna especialidad de la agenda se considera confiable para operaciones clínicas. El selector de plantilla rechaza valores no reconocidos (incluidos `__proto__`, Kardex y Evolución); si no existe una constancia de asistencia válida, muestra **Planilla no disponible** y nunca abre Medicina como alternativa.

**Para la app real**, el profesional y la cobertura deben provenir de Auth + Edge/RLS del Supabase independiente y estar vinculados a un episodio y equipo autorizados. No derivar permisos clínicos de una especialidad pasada por el cliente. No activar guardado, firmas, evolución, rendición ni descarga de PDF sin completar HC-UX-03B y el circuito de autorización.

Pruebas RN/Jest: un clic Inicio→planilla correcta, agenda→planilla, tableta ancha, cambio al catálogo libre solo desde pestaña, rechazo de especialidad extraña, rechazo de modo enfocado para documentos físicos/evolución. Las exportaciones Android/iOS siguen siendo bundles de CI, **no** APK/IPA instalables.

## HC-UX-04B2 — Planilla individual determinada por la cobertura del servidor

En \`src/authorizedFormPreviewClient.ts\` queda preparado el lector HTTP fijo de \`resolveMyHomecareAttendanceTemplate\` (HC-UX-04B1). **Solo puede llamar a un proyecto staging independiente explícitamente habilitado**, siempre después de obtener el JWT de un proveedor Auth inyectado, nunca del login del CONSULTLAN ambulatorio. La petición incluye únicamente el UUID de cobertura; la respuesta devuelve uno de seis modelos de asistencia, \`READ_ONLY_STRUCTURE_PREVIEW\` y ninguna información clínica. No permite seleccionar una especialidad desde el cliente.

\`src/assignedFormSessionController.ts\` conserva exclusivamente el identificador de la plantilla en memoria y limpia inmediatamente al cambiar cobertura o sesión. \`src/StagingAssignedFormPreview.tsx\` muestra **un botón** y esa plantilla en modo enfocado (sin firmas, documentos, PDF o edición); se limpia ante Auth y segundo plano.

**La pantalla NO está conectada a \`App.tsx\`**, no hay proyecto Supabase remoto desplegado ni pacientes reales. Solo se ejecuta con fixtures de CI. Para validar la relación \`cobertura -> profesional -> episodio -> plan -> especialidad\` con autenticación real hace falta staging independiente y usuarios exclusivamente ficticios, según [SPEC HC-UX-04B2](../../docs/specs/HC-UX-04B2-assigned-form-reader.md). El cotejo privado de los DOCX originales sigue pendiente (issue #57).

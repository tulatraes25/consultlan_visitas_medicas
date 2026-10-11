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

## Adaptador de lectura futura (MOB-DATA-01)

El código `src/readonlyCoverageClient.ts` prepara una futura consulta **POST a una Edge Function con validación de sesión activa** en el Supabase autónomo, con llave publicable y JWT de usuario de Auth. **No está importado por las pantallas y no hace llamadas reales**. El backend **incluye HC-READ-01 en el repositorio**, con comprobación de sesión y una RPC de seis campos; **no existe un Supabase desplegado ni se permite usar esta acción con pacientes reales**. HTTP 422 se rechaza explícitamente, jamás se convierte en agenda vacía. No realiza GET directos a PostgREST, que podrían aceptar un JWT luego de cerrar sesión. Los tests solo simulan respuestas. Las credenciales privilegiadas y la verificación real de permisos permanecen exclusivamente en el servidor; sin datos clínicos, firma ni pacientes reales.

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

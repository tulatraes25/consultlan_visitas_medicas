# Pediatrics Visitas — aplicación móvil (DEMO)

**Scope:** navegación de muestra para teléfono y tablet. **No habilita prestaciones reales.** La arquitectura decidida para la aplicación operativa es un Supabase independiente, sin conexión con Pediatrics/CONSULTLAN; esta demo aún no se conecta a Supabase.
**Datos:** 6 registros sintéticos creados en memoria, relativos a la fecha local del dispositivo. No almacena ni envía información personal.

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
6. Gestión administrativa simulada: pacientes ficticios, profesionales ficticios por especialidad, selección de horarios y asignación local visible en la agenda. No crea cuentas reales ni persiste datos.

## Límites y seguridad
- Se muestra siempre **MODO DEMO · datos ficticios**.
- La pestaña Gestión solo sirve para probar UX, **no es una ruta autenticada ni representa permisos reales**. Solo admite códigos de 1 a 4 caracteres y genera nombres de muestra.
- Las futuras invitaciones a Supabase Auth y las altas clínicas reales no están conectadas a estos formularios.
- No hay autenticación, conexión a CONSULTLAN, historias clínicas, firma electrónica/digital válida ni guardado de documentos.
- La prueba táctil usa trazos SVG **en memoria volátil**. Al cerrar el modal se desmonta el lienzo y se descartan sus trazos; no existe botón de enviar o firmar.
- La selección de vínculo familiar es ilustrativa y **no verifica identidad** ni autorización de cuidadores.
- El registro de asistencia del familiar y la firma digital certificada del profesional seguirán siendo documentos separados.
- Ninguna acción clínica se simula como aceptada o certificada.
- No publicar en stores ni conectar con API real desde este prototipo.
- Los colores provienen del sistema institucional: `#166534`, `#0B3D2A`, `#DDF5E6`.
- Próximo gate: configurar Supabase Auth propio y conectar solo lectura autorizada tras validar RLS en un proyecto staging. Edge Functions auditadas servirán para cambios de estado, altas y firmas. No introducir service_role ni otros secretos en el móvil.

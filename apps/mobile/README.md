# Pediatrics Visitas — aplicación móvil (DEMO)

**Scope:** navegación de muestra para teléfono y tablet. **No habilita prestaciones reales.**
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

## Límites y seguridad
- Se muestra siempre **MODO DEMO · datos ficticios**.
- No hay autenticación, conexión a CONSULTLAN, historias clínicas, firma ni guardado de documentos.
- Ninguna acción clínica se simula como aceptada o certificada.
- No publicar en stores ni conectar con API real desde este prototipo.
- Los colores provienen del sistema institucional: `#166534`, `#0B3D2A`, `#DDF5E6`.
- Próximo gate: pantalla de autenticación real y API backend con permisos estrictos; antes, resolver la arquitectura de identidad y la cadena de custodia.

# HC-UX-04C — Flujo único de agenda a planilla segura (staging dormido)

**SPEC/Kiro · 2026-10-12 · fase Github offline · NO-GO clínico**

## Objetivo
Dejar ensamblado, sin SDK real ni despliegue, el camino de un profesional: consultar sus coberturas desde Edge → seleccionar **una cobertura propia** → consultar solo la planilla original cuya estructura autoriza el backend. Debe poder ensayarse en React Native Jest sobre datos sintéticos con un mismo proveedor de autenticación y sin iniciar solicitudes al montar.

## Decisión de seguridad
- `StagingProfessionalWorkflowPreview` **no se importa en `App.tsx`** y carece de credenciales institucionales.
- El mismo `ReadOnlyCoverageConfig` validado crea **ambos** controladores: agenda paginada y lector de planilla. No se puede inyectar una segunda referencia Supabase a la vista de formulario.
- La selección solo proviene de una fila visible de la consulta Edge con `state=ready`; queda ligada por **identidad de snapshot**, no solo por UUID. Cualquier nueva página, actualización de agenda o cambio de sesión la invalida antes de volver a mostrar la planilla.
- Después de elegir se hace **otra** validación de Auth + sesión y autorización del servidor. No se confía en especialidad, actor, organización, paciente ni templateId elegidos en el teléfono.
- `logout`, refresh, segunda página, cambio de ventana, nuevo Auth/provider o desmontaje ocultan inmediatamente la planilla, borran selección y abortan respuestas tardías. Cambio de proyecto bloquea por defecto en constructor antes de solicitar token.
- La agenda se **oculta** mientras se ve la planilla de solo lectura; al volver aparece otra vez, sin conservar el formulario. El lector de pantalla no recibe controles de dos pantallas a la vez.
- Sin almacenamiento local, red espontánea, datos clínicos, firma o emisión de documentos. El único botón operativo fuera de lectura es volver a la agenda de prueba.

## Aceptación
1. Montar el flujo con configuración ficticia produce **cero** solicitudes a Edge y cero llamadas a Auth hasta que se pulse consultar.
2. Consultar agenda sintética y seleccionar cobertura propia muestra **un** CTA adicional para verificar una planilla; antes de pulsarlo no hay modelo visible. La respuesta permite solo uno de seis tipos de constancia y nunca datos del paciente.
3. Al cerrar sesión, reemplazar proveedor o ventana, refrescar token, volver a agenda o recargar páginas, se oculta la plantilla vieja sin fallback.
4. Rechazar proyecto excluido y `sb_secret_*` antes de red.
5. Suite Jest React Native y TypeScript estricto, exports Android/iOS y PostgreSQL RLS/Edge/Browser Quality Gate **cinco trabajos verdes**; merge normal y post-main CI.
6. `apps/mobile/App.tsx` conserva únicamente la demostración ficticia sin conexión; ningún flujo clínico se habilita mediante este PR.
7. HC-UX-04D retira el ensamblador previo que aceptaba controladores separados: solo se permite este flujo, con **una configuración** y un único proveedor Auth; probar rechazo 403, logout, cambios de ventana/proveedor y selección inválida.

## Bloqueo de salida
La conexión a Supabase requiere autorización institucional de un **proyecto autónomo staging** de internación domiciliaria y **STAGING-01F-REMOTE** (dos organizaciones, identidades artificiales, sesión revocada y RLS remoto). La autorización médica, firma, consentimiento y fidelidad de DOCX/PDF originales siguen pendientes. Una demo funcional **no** es prueba de una visita realizada.

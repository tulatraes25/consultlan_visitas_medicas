# MOB-DATA-01 — Adaptador de lectura mínima de agenda Supabase (no conectado)

**SPEC/Kiro · 2026-10-10 · Candidato de infraestructura, solo pruebas sintéticas.**
Aplicación para teléfonos y tablets de internación domiciliaria pediátrica. Independiente del servidor CONSULTLAN y de los pacientes ambulatorios de Pediatrics.

## Objetivo
Preparar un contrato de lectura para profesionales autenticados que recupere desde el **Supabase autónomo** exclusivamente metadatos de coberturas `VISIT`/`SHIFT`. La interfaz sigue 100% en demostración, sin conexión ni datos reales.

## Requisitos
1. El adaptador no se importa ni invoca desde la interfaz productiva/demo. Solo podrá conectarse tras cerrar STAGING-01A/B/C, auditar Auth/RLS reales, contar con permisos institucionales y validar el proyecto separado.
2. Exigir configuración explícita `stagingReadAuthorized=true`, project ref Supabase de 20 caracteres, lista no vacía de referencias **excluidas** que no incluya al staging y clave `sb_publishable_`. Nunca aceptar `sb_secret_`, `service_role`, URL externa, userinfo, redirección o un origen elegido por el usuario final.
3. JWT **de usuario**, obtenido bajo demanda del proveedor Auth del Supabase independiente. El móvil no declara `actor`, rol, `organization_id` ni identidad como autoridad. El servidor/PostgreSQL RLS decide qué profesional o coordinador puede leer.
4. Solo un `GET` a una URL fija de tabla `homecare_coverage_assignments` con proyección `id,episode_id,service_kind,coverage_state,scheduled_start,scheduled_end`, orden cronológico y límite técnico de 100 filas; no solicita `patient_id`, diagnósticos, notas, órdenes, contactos ni firmas.
5. Validar tamaño y forma exacta de respuesta; si aparece una columna clínica o ajena, un UUID inválido, modalidad desconocida, estado inesperado o período inválido, fallar de forma segura. No incorporar automáticamente campos desconocidos a vistas clínicas.
6. Manejar 401/403, error de conexión, respuesta inválida y token ausente sin registrar JWT, detalles de la fila, URL privada o respuesta de la API. Desactivar caché y seguir prohibiendo HTTP redirects.
7. `possiblyTruncated=true` con exactamente 100 filas indica que **pueden** quedar coberturas fuera de la respuesta. No afirmar agenda completa con una única página.
8. Permitir `AbortSignal` del llamador. No crear pacientes, emitir órdenes, modificar coberturas, confirmar relevos, aceptar consentimientos ni firmar.

## Archivos
- `apps/mobile/src/readonlyCoverageClient.ts`: adaptador REST inerte, con validación de configuración/resultado.
- `apps/mobile/__tests__/readonlyCoverageClient.test.ts`: escenarios con transporte falsificado; cero credenciales reales.
- `apps/mobile/README.md`: límite de conexión y futura integración.

## Criterios de aceptación
- Los tests prueban un GET exacto sin campos clínicos ni body, JWT y publishable solo en header y denegación antes de red en configuración inválida.
- Se bloquean cuerpos con campos adicionales, estados incorrectos, intervalos inválidos, HTML/JSON inesperado, errores HTTP, token perdido y truncamiento indebido.
- Expo TypeScript estricto, Jest React Native, exportaciones JS Android/iOS y los jobs de privacidad, PostgreSQL y Deno existentes pasan en el SHA exacto del PR.
- No declarar despliegue, APK/IPA, RLS real ni autorización clínica. La prueba con JWT real de profesional solo podrá hacerse en staging aprobado y con datos ficticios.

## Decisiones y riesgos
La tabla RLS definida en HC-02A permite lectura a coordinación autorizada o al profesional asignado y miembro activo del equipo de un episodio ACTIVE/SUSPENDED. Estas restricciones deben comprobarse **en Supabase real**; los filtros de cliente no sustituyen RLS. No incluir nombres, direcciones, identificaciones ni narrativas clínicas en el resultado mínimo. La app seguirá usando fixtures de `demoData.ts` hasta completar infraestructura y aprobaciones humanas.

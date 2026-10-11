# MOB-DATA-01 — Adaptador de lectura mínima de agenda Supabase (no conectado)

**SPEC/Kiro · 2026-10-10 · Candidato de infraestructura, solo pruebas sintéticas.**
Aplicación para teléfonos y tablets de internación domiciliaria pediátrica. Independiente del servidor CONSULTLAN y de los pacientes ambulatorios de Pediatrics.

## Objetivo
Preparar un contrato de lectura para profesionales autenticados que recupere desde el **Supabase autónomo** exclusivamente metadatos de coberturas `VISIT`/`SHIFT` **por una futura Edge Function con control de sesión activa**. La interfaz sigue 100% en demostración, sin conexión ni datos reales. El backend todavía no implementa esta lectura y actualmente la Edge devuelve 422.

## Requisitos
1. El adaptador no se importa ni invoca desde la interfaz productiva/demo. Solo podrá conectarse tras cerrar STAGING-01A/B/C, auditar Auth/RLS reales, contar con permisos institucionales y validar el proyecto separado.
2. Exigir configuración explícita `stagingReadAuthorized=true`, project ref Supabase de 20 caracteres, lista no vacía de referencias **excluidas** que no incluya al staging y clave `sb_publishable_`. Nunca aceptar `sb_secret_`, `service_role`, URL externa, userinfo, redirección o un origen elegido por el usuario final.
3. JWT **de usuario**, obtenido bajo demanda del proveedor Auth del Supabase independiente. El móvil no declara `actor`, rol, `organization_id` ni identidad como autoridad. **La Edge deberá verificar el JWT y la sesión vigente (`auth.sessions`) antes de cualquier futura RPC**, que a su vez debe aplicar permisos de organización, episodio y asignación profesional mediante SQL.
4. Solo un **POST Edge** a `/functions/v1/visits` con acción fija desconocida actualmente `listMyHomecareCoverages`, sin argumentos ni selección de paciente/organización. **Ningún GET directo a PostgREST**, pues podría seguir aceptando un JWT hasta su expiración aun si la sesión ya fue cerrada. Una futura RPC, todavía no implementada, deberá devolver únicamente `id,episode_id,service_kind,coverage_state,scheduled_start,scheduled_end` con orden y máximo 100 filas; no debe devolver `patient_id`, diagnósticos, notas, órdenes, contactos ni firmas.
5. **Mientras la Edge no incorpore el nuevo comando, HTTP 422 se considera `ROSTER_EDGE_READ_NOT_IMPLEMENTED`, no una lista vacía**. Aceptar solo sobre HTTP 200 el sobre exacto `{ok:true,result:[...]}`; validar máximo 100 filas y forma exacta. Si aparece una columna clínica o ajena, un UUID inválido, modalidad desconocida, estado inesperado o período inválido, fallar de forma segura. No incorporar automáticamente campos desconocidos a vistas clínicas.
6. Manejar 401/403, error de conexión, respuesta inválida y token ausente sin registrar JWT, detalles de la fila, URL privada o respuesta de la API. Desactivar caché y seguir prohibiendo HTTP redirects.
7. `possiblyTruncated=true` con exactamente 100 filas indica que **pueden** quedar coberturas fuera de la respuesta. No afirmar agenda completa con una única página.
8. Permitir `AbortSignal` del llamador. No crear pacientes, emitir órdenes, modificar coberturas, confirmar relevos, aceptar consentimientos ni firmar.

## Archivos
- `apps/mobile/src/readonlyCoverageClient.ts`: adaptador **Edge** inerte, con validación de configuración, respuesta y acción no implementada.
- `apps/mobile/__tests__/readonlyCoverageClient.test.ts`: escenarios con transporte falsificado; cero credenciales reales.
- `apps/mobile/README.md`: límite de conexión y futura integración.

## Criterios de aceptación
- Los tests prueban un POST Edge de nombre/acción fija, sin argumentos clínicos, JWT y publishable solo en headers; se niegan GET directos, configuración inválida y ruta Edge aún no implementada.
- Se bloquean cuerpos con campos adicionales, estados incorrectos, intervalos inválidos, HTML/JSON inesperado, errores HTTP, token perdido y truncamiento indebido.
- Expo TypeScript estricto, Jest React Native, exportaciones JS Android/iOS y los jobs de privacidad, PostgreSQL y Deno existentes pasan en el SHA exacto del PR.
- No declarar despliegue, APK/IPA, RLS real ni autorización clínica. La prueba con JWT real de profesional solo podrá hacerse en staging aprobado y con datos ficticios **después de crear una RPC de lectura con pruebas negativas de RLS y sesión**.

## Decisiones y riesgos
La tabla RLS definida en HC-02A permite lectura a coordinación autorizada o al profesional asignado y miembro activo del equipo de un episodio ACTIVE/SUSPENDED, pero una consulta PostgREST con JWT no necesariamente verifica la revocación inmediata de `auth.sessions`. Por ello el cliente **no consultará la tabla directamente**: el flujo futuro será Edge + Auth/sesión activa + RPC SQL con permisos restrictivos. Todo se deberá comprobar en Supabase real; los filtros de cliente no sustituyen RLS. No incluir nombres, direcciones, identificaciones ni narrativas clínicas en el resultado mínimo. La app seguirá usando fixtures de `demoData.ts` hasta completar infraestructura y aprobaciones humanas.

# HC-UX-04B2 — Lector móvil seguro de planilla asignada

**SPEC/Kiro · 2026-10-12 · issue #60 · exclusivamente staging sintético, sin despliegue**

## Decisión de producto

Para el profesional nuevo, la planilla adecuada debe aparecer con **un único botón**, sin elegir especialidad. La versión anterior (HC-UX-04A) lo demostraba con datos ficticios y especialidades definidas en el celular. HC-UX-04B1 implementó en PostgreSQL + Edge la resolución **a partir de la cobertura real del actor autenticado**. Esta etapa agrega el lector y pantalla móvil de solo lectura, pero los mantiene **desconectados de App.tsx y de cualquier Supabase alojado** hasta autorizar el staging institucional.

## Contrato de lectura

- **Entradas permitidas**: \`coverageId\` UUID, autenticación obtenida bajo demanda del proveedor Supabase Auth propio de la internación domiciliaria, referencia de staging explícitamente autorizada, lista de referencias prohibidas y clave pública \`sb_publishable_*\`. El cliente envía POST solo a \`/functions/v1/visits\`; nunca consulta tablas de PostgREST ni acepta URL, actor, especialidad, rol, paciente, episodio, plantilla o firma.
- **Autoridad**: la función Edge confirma JWT + sesión viva, inyecta \`p_actor\` y la RPC SQL revalida membresía, profesional, equipo, episodio, plan aprobado de fixture y cobertura personal. El resultado está restringido a \`{templateId,mode:"READ_ONLY_STRUCTURE_PREVIEW"}\`.
- **Validador móvil**: la respuesta debe ser exactamente \`{ok:true,result:{templateId,mode}}\` con dos claves permitidas y un \`templateId\` entre las **seis constancias HC-03A**. Cualquier columna ajena, evolución, Kardex, órdenes, paciente, firma o cambio de estado se rechaza. No hay sustitución por Medicina ni retorno genérico de todas las plantillas.
- **Aislamiento de sesión**: \`createAssignedFormSessionController\` borra el estado al iniciar otra consulta, al llamar \`clear\`, al cambiar cobertura, al cerrar sesión/reemplazar Auth, pasar a segundo plano o desmontar la pantalla. Usa \`epoch\` y \`AbortController\` contra respuestas tardías y vuelve a leer el token del proveedor **antes de publicar**. JWT y errores upstream nunca salen al snapshot.
- **Presentación simple**: \`StagingAssignedFormPreview\` tiene un botón "Ver mi planilla de prueba", muestra únicamente la plantilla seleccionada por el servidor con \`FormCatalogDemo\` en **modo enfocado**, y ofrece "Ocultar planilla". No aparece el catálogo de especialidades, evolución, capturas clínicas, PDF, consentimiento ni firmas. El primer render bloquea un snapshot anterior hasta vincular Auth + cobertura + controlador actuales.

## Matriz de aceptación

1. Crear cliente o controlador sin usar red ni leer token; si se especifica ref prohibida, URL distinta, clave \`sb_secret_*\` o staging no habilitado, fallar antes de Auth/red.
2. Petición HTTP debe incluir **solo** acción fija + UUID de cobertura; ningún otro dato del usuario o paciente en JSON. Cabeceras con clave pública y token de usuario solo en la solicitud a Edge.
3. Admitir exactamente seis IDs de constancia, incluidos casos de enfermería/guardia. Rechazar evolución, papel, parámetros manipulados, campos agregados, respuesta no válida, error upstream y permisos revocados.
4. Cualquier cambio de token, logout, \`TOKEN_REFRESHED\`, reemplazo de proveedor/cobertura, segundo plano, unmount o respuesta tardía debe dejar \`templateId=null\`; la UI nunca muestra un documento ajeno entre renders.
5. Pantalla teléfono 390 px y tablet 1280 px: acción principal única, resultado enfocado y sin selector, sin edición ni identificadores personales.
6. Mantener **cinco trabajos de Quality Gate**: privacidad/contratos, PostgreSQL RLS multi-tenant, Edge JWT+sesión, RN TypeScript/Jest Android/iOS JS y navegador web. Merge normal + post-main CI antes de \`CLOSED_CERTIFIED\`.

## Limitaciones y riesgos expresos

- **NO-GO producción y pacientes reales.** No hay aún un Supabase de staging independiente registrado, operador institucional aprobado ni integración Auth en la app principal. Ni siquiera se crea un SDK cliente: las dependencias se inyectan en las pruebas.
- El móvil no asocia todavía la tarjeta de una cobertura autenticada al lector; esta pantalla **permanece dormida** y no debe conectarse a \`App.tsx\` antes de aprobar un staging sintético y pruebas completas de Auth en un proyecto independiente.
- La versión \`APPROVED\` de un plan SQL de CI **no es una aprobación médica**. Faltan habilitación profesional, aprobación Dirección Médica, procedimiento de firma/representación y revisión del financiador.
- Las plantillas DOCX/PDF originales privadas y el ejemplo de expediente de 56 páginas siguen pendientes de cotejo visual en issue #57. Una vista de campos correcta **no equivale a un documento emitible**.

## Siguiente gate exacto

**HC-UX-04B3 / STAGING-01F-REMOTE:** configurar bajo autorización institucional un Supabase exclusivo de internación domiciliaria con **identidades y pacientes sintéticos**, aplicar el manifiesto de migraciones exactas y sus pruebas, verificar Auth+sesión+RLS con dos organizaciones y luego conectar el lector a una cobertura seleccionada de la agenda segura. El issue padre #60 permanece ABIERTO hasta la prueba remota y la decisión médica/administrativa; no se habilita uso real.

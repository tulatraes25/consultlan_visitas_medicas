# STAGING-01F — Pruebas integradas de Auth, aislamiento y revocación

**SPEC/Kiro · 11/10/2026 · preparado en GitHub · ejecución REMOTA pendiente de un Supabase staging expresamente autorizado.**

## Hallazgo

STAGING-01A valida el destino y dos pruebas negativas anónimas. STAGING-01B comprueba lectura Edge propia entre dos organizaciones inventadas y cierre de las 14 tablas a lectura JWT directa. STAGING-01C compara JWT activo, firmado/revocado, vencido y ausente.

Aunque cada prueba estaba validada por separado con transporte simulado, **01B y 01C podían estar configuradas para distintos actores o tokens**, sin demostrar que el usuario A protegido por el aislamiento de episodios estuviese protegido también por el control de sesión activa.

## Objetivos y requisitos

1. Usar un solo proyecto Supabase **nuevo**, autónomo y nunca compartido con Pediatrics ambulatorio o SICOM. Su identidad debe validarla un operador autorizado contra Dashboard y registro institucional; variables locales **no son prueba**.
2. Exigir todos los opt-ins anteriores: `STAGING_ENVIRONMENT=staging`, `STAGING_OPERATOR_APPROVED=YES`, `STAGING_NO_REAL_PATIENTS=YES`, `STAGING_ALLOW_NETWORK=YES` para red, `STAGING_RLS_E2E=YES`, `STAGING_SESSION_E2E=YES`, `STAGING_SYNTHETIC_FIXTURES=YES`, `STAGING_SESSION_REVOCATION_CONFIRMED=YES`, URL canónica y publishable key, sin secretos privilegiados.
3. Nueva declaración `STAGING_OPERATOR_PROJECT_IDENTITY_VERIFIED=YES`. **Es una afirmación del operador y no evidencia independiente.** Rechazar configuración incompleta sin hacer una sola solicitud.
4. Identidad cruzada obligatoria: `STAGING_SESSION_USER_ID = STAGING_USER_A_ID`; `STAGING_SESSION_ACTIVE_JWT = STAGING_USER_A_JWT`; `STAGING_SESSION_EXPIRED_JWT = STAGING_EXPIRED_USER_JWT`. El JWT revocado de la misma cuenta A tiene otra sesión y una fecha de vencimiento futura. No imprimir ni conservar tokens.
5. Congelar una copia del entorno tras validarlo, impidiendo que un cambio posterior del objeto de configuración redirija la segunda o tercera fase a otro destino.
6. Ejecutar secuencialmente y fallar ante el primer problema: 01A (2 solicitudes), 01B (22 solicitudes) y 01C (6 solicitudes). Total **30 comprobaciones HTTP acotadas**, GET de Auth/PostgREST o POST Edge con acción de solo lectura o deliberadamente desconocida. No escribir, crear registros ni ejecutar órdenes clínicas.
7. CLI: `--ci` sin red/secretos; `--check-env` valida declaraciones sin red; `--probe` solo para operador con opt-ins, usuarios ficticios y destino identificado.
8. Nunca mostrar URLs, IDs, tokens, respuestas HTTP, errores originales o datos reales en las salidas. Emitir únicamente códigos de estado fijos.
9. Aun pasando `--probe`, no declarar validados ownership/región, catálogo de SQL, migraciones, backups, restauración, Storage, consentimientos, firmas, registros clínicos, seguridad de menores ni habilitación sanitaria.

## Cambios y pruebas

- `src/operations/staging-integrated-policy.mjs`: vínculo cruzado de identidades, congelado de configuración y orquestación.
- `scripts/staging-integrated-verify.mjs`: CLI sin credenciales en archivos y salida fail-closed.
- `test/staging-integrated-policy.test.mjs`: transporte mock para 30 solicitudes, accesos entre organizaciones, JWT revocados, mismatches de tokens y actores, ausencia de red sin autorización y bloqueo de cambios de destino en mitad del proceso.
- `.github/workflows/quality-gate.yml`: sintaxis, prueba offline y suite Node más PostgreSQL RLS, Deno Auth/Edge y Expo Android/iOS.

## Protocolo institucional fuera de GitHub

1. El operador identifica la titularidad, región y ref exacta de un proyecto **exclusivo** para internación domiciliaria. Contrasta contra las referencias explícitamente prohibidas de Pediatrics/CONSULTLAN y SICOM, y autoriza por escrito el ensayo con dos organizaciones ficticias.
2. En un checkout Git limpio de un SHA aprobado, generar el manifiesto STAGING-01D y guardarlo fuera del repositorio. Tras la instalación institucional autorizada de migraciones, comprobar la tabla de migraciones con STAGING-01E y estructura/catálogo con el SQL STAGING-01D mediante conexión segura y comandos READ ONLY. **Esas operaciones no las realiza el nuevo orquestador.**
3. Crear fuera de GitHub dos organizaciones ficticias A/B, dos identidades sintéticas y sus episodios no vacíos. Preparar un token A activo y otro firmado aún vigente de una sesión A terminada; reservar un JWT A vencido. Compartir las variables de token A activo y vencido entre 01B y 01C exactamente como establece el punto 4. Nunca incluir datos de niños reales.
4. Usar primero `node scripts/staging-integrated-verify.mjs --check-env` (sin red). Ante cualquier fallo detener la prueba sin cambiar a secret/service_role key.
5. Con evidencia de destino institucional y migraciones/catálogo correctos, ejecutar `node scripts/staging-integrated-verify.mjs --probe` en entorno autorizado. Un PASS solo permite anotar `STAGING01F_NETWORK_BOUNDARIES_PASS_REMOTE_SQL_AND_OWNER_AUDIT_PENDING`, sin certificación clínica.
6. Custodiar los resultados en archivo institucional seguro con fecha, responsable, commit exacto, ref verificada del proyecto y actas SQL. **No almacenar JWT, contraseñas ni información de pacientes** en reportes, GitHub o chats.

## Criterios de aceptación y NO-GO

- CI en HEAD exacto 4/4, incluyendo nuevos tests Node y offline. El orquestador no importa SDKs externos ni efectúa llamadas a la red en el CI.
- No hay ejecución contra Supabase alojado hasta contar con aprobación e infraestructura real. Un PASS sintético se denomina `OFFLINE` y no `STAGING-01F-CLOUD-PASS`.
- El protocolo solo observa los 30 comportamientos descritos; no demuestra todas las políticas SQL ni resuelve tratamiento legal de datos de menores, responsabilidad profesional, habilitación institucional, copias de seguridad o respuesta a incidentes.
- Ningún flag habilita clínicamente aprobación de planes, firma, admisión, órdenes médicas o atención real.

**Siguiente gate exacto:** `STAGING-01F-REMOTE`, ejecución autorizada en el nuevo Supabase y auditoría de su evidencia. Si no hay staging, estado `REMOTE_NOT_EXECUTED`, continuar únicamente tareas sintéticas.

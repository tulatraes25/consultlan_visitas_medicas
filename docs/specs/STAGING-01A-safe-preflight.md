# STAGING-01A — Preflight seguro para Supabase independiente

**Estado:** SPEC/Kiro — preparación local/CI de staging, sin aprovisionamiento externo ni pacientes reales. Fecha de apertura 2026-10-10.

## Objetivo
Pasar del PostgreSQL sintético y la Edge sin credenciales a un protocolo reproducible de inspección para un **Supabase nuevo, exclusivo de internación domiciliaria pediátrica**, sin confundir un test de CI con validación clínica. No acceder al servidor ni a los pacientes ambulatorios de Pediatrics/CONSULTLAN ni al proyecto SICOM.

## Alcance de este gate
- CLI local: `node scripts/staging-preflight.mjs --ci` valida archivos, seguridad de funciones y secuencia de migraciones SIN salir a internet y SIN solicitar secretos.
- `--check-env`: valida valores de entorno destinados a staging y sus afirmaciones mínimas sin contactar proveedor ni exponer claves. Una declaración del operador no es verificación independiente.
- `--probe`: **solo por acción explícita del operador**, realiza dos comprobaciones negativas de bajo impacto contra un endpoint exacto `https://<project-ref>.supabase.co`: lectura anónima mínima y Edge con acción desconocida y sin JWT de usuario. No crea registros, no se autentica como paciente, no prueba representación legal, no emite firmas y no instala migraciones.
- CI ejecuta el preflight sin red y las pruebas negativas en Node con transporte simulado, además de los cuatro jobs existentes.

## Requisitos de seguridad y privacidad
1. Fallar si el destino no es un subdominio HTTPS exacto de Supabase y la referencia no coincide. Rechazar localhost, IP, dominios personalizados, URLs con usuario/contraseña, puerto, path, query o hash. **Prohibir referencias de proyectos conocidos** y coincidencia con el proyecto de producción/CONSULTLAN/SICOM.
2. El comando de red exige flags explícitos `STAGING_ENVIRONMENT=staging`, `STAGING_OPERATOR_APPROVED=YES`, `STAGING_NO_REAL_PATIENTS=YES`, `STAGING_ALLOW_NETWORK=YES`, `STAGING_PROJECT_REF`, `STAGING_URL`, `STAGING_PUBLISHABLE_KEY` y `STAGING_FORBIDDEN_PROJECT_REFS` no vacío. Nunca acepta `sb_secret_`, service_role ni JWT como llave pública. Estas variables **no demuestran** por sí solas aislamiento real.
3. Ninguna credencial por argumento CLI, archivo de repositorio, URL o log. El preflight informa únicamente códigos de estado sin imprimir referencias, respuesta HTTP, identificadores, tokens o contenido.
4. Para el muestreo anónimo, HTTP 401/403 es denegación; 200 solo es aceptable con arreglo JSON vacío. Cualquier registro visible constituye falla. Esta verificación **no demuestra RLS completo** si la tabla está vacía: habrá que validar con varios usuarios sintéticos.
5. Para la Edge, POST con acción deliberadamente desconocida, sin Authorization/JWT, debe responder 401 o 403. HTTP 200/422 o 404 se tratan como falla y no se ignoran. El body nunca contiene pacientes ni operaciones reales.
6. Los requests tienen timeout, `redirect: error` y `cache: no-store`. No se almacenan respuestas, ni telemetría, ni capturas en el repositorio.
7. `--ci` exige `project_id` local definido en config.toml, `verify_jwt = true` para visitas, las siete migraciones en orden y retirada de comandos clínicos históricos de la Edge; comprueba que la migración final revoca permisos de las cinco RPC antiguas.
8. No se habilitan comandos para activar episodios, aprobar planes, cargar documentos, medicación, registrar asistencia ni firmar.
9. No ejecutar `supabase db reset --linked` ni `db push` automáticamente. El aprovisionamiento real requiere autorización de la institución, responsable de datos, configuración de Auth/Storage/backups, inspección de RLS y checklist en staging.
10. El proyecto fuente es público: prohibido subir archivos `.env`, bases, dumps, llaves, certificados o datos sensibles a GitHub.

## Modelo de implementación
- `src/operations/staging-policy.mjs`: política pura de validación de destino/flags y contrato de prueba negativa (fetch inyectable).
- `scripts/staging-preflight.mjs`: CLI Node 22 sin dependencias y modo offline por defecto.
- `test/staging-policy.test.mjs`: pruebas negativas, verificación de no llamadas de red en modo offline, protección de destino, roles/llaves, respuestas no esperadas y solicitudes realmente sin JWT.
- `supabase/config.toml`: project_id exclusivamente local; sin project ref real ni secrets.
- `.github/workflows/quality-gate.yml`: gate offline con pruebas sintéticas.
- `docs/operations/STAGING-01-runbook.md`: preparación y pasos **manuales** para creación/validación del proyecto, nunca ejecución destructiva.

## Criterios de aceptación
- 4 jobs GitHub existentes + tests de preflight en CI, pasando sobre SHA exacto, PR revisado y merge normal.
- Sin claves nuevas, sin cambios en esquemas productivos, sin red en CI y sin datos reales.
- Rechazo por destino inadecuado, credencial secreta, confirmaciones ausentes, project ref prohibido y respuesta Edge permisiva.
- `--probe` únicamente con consentimiento del operador y bloqueado hasta tener proyecto staging separado. **Este gate termina READY_FOR_STAGING_VALIDATION, NO CLINICALLY_READY.**

## Riesgos y próximos gates
- STAGING-01B: proyecto Supabase realmente creado por Pediatrics (o autorizado explícitamente), región, titularidad, aislamiento, backups, MFA, política de retención y auditoría.
- STAGING-01C: cuentas sintéticas multi-organización, SQL/REST RLS con datos no vacíos, sesiones revocadas, Edge runtime y restauración de backup.
- HC-02C2 + HC-03C: aprobación médica, custodia legal, identidad/representación de menores, firmas y documentación sanitaria siguen bloqueados.

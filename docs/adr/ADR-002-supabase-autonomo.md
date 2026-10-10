# ADR-002 — Plataforma Supabase autónoma para internación domiciliaria

**Estado:** ACCEPTED (decisión del dueño del producto, 2026-10-10).
**Sustituye:** propuesta de API conectada a CONSULTLAN del ADR-001 y requisito R10 original del SPEC-001.
**Ámbito:** `tulatraes25/consultlan_visitas_medicas`.

## Decisión vinculante
La aplicación **no** se conecta con el servidor Pediatrics/CONSULTLAN y **no** comparte base, usuarios, tokens ni historias clínicas con él. Todo se crea desde cero en **un proyecto Supabase diferente**, que tendrá:
- **Supabase Auth:** acceso de profesionales y coordinación, invitación administrada; deshabilitar registro abierto y anónimo en el proyecto productivo; habilitar MFA según política asistencial.
- **Supabase PostgreSQL:** organizaciones, profesionales, pacientes, asignaciones, visitas, notas clínicas, conformidad de asistencia y auditoría.
- **Row Level Security (RLS) + privilegios SQL mínimos:** solo el profesional activo asignado accede a datos clínicos de su visita. Coordinación/administración gestiona operaciones, **sin** lectura automática de notas clínicas. Roles nunca se elevan desde datos editables en el cliente.
- **Supabase Edge Functions** (etapa futura): altas/bajas privilegiadas, cambios de estado, custodia y cierre de evidencias, generación de documentos. Cada función validará usuario, rol, organización, alcance por visita y versiones, incluso usando credencial privilegiada en el servidor.
- **Supabase Storage privado** (etapa futura): versiones de PDF, constancias y evidencias bajo políticas de acceso; jamás buckets públicos para datos de salud.
- **React Native/Expo:** identidad visual heredada de CONSULTLAN (solamente tokens de estilo), sin reutilizar servicios de CONSULTLAN.

## Cambios con respecto al plan inicial
- Se **elimina** la API de CONSULTLAN como fuente de pacientes, profesionales y asignaciones; no hay sincronización ni dependencia de disponibilidad del servidor de Pediatrics.
- El antiguo `contracts/openapi.visits.json` pasa a ser **contrato conceptual no implementado**; las operaciones HTTP reales se definirán en Edge Functions/RPC y Supabase Data API con RLS. No usar el JSON anterior para llamar al servidor Pediatrics.
- La cuenta de cada profesional **no** es una cuenta de CONSULTLAN: se invita en Supabase Auth, vincula por `auth.users.id` al rol y perfil profesional de esta app, y se revoca desde esta misma plataforma.
- Pacientes y responsables se incorporan en la base propia; **no** migrar ni copiar datos clínicos de Pediatrics salvo acuerdo posterior explícito y base legal documentada.
- El proyecto Supabase debe aprovisionarse bajo control de Pediatrics, con propiedad, región, contrato y responsables de datos acordados antes de incorporar historias clínicas reales.

## Modelo de permisos V1
| Rol app | Visitas operativas | Pacientes | Notas clínicas | Evidencia de asistencia | Administración |
|---|---|---|---|---|---|
| ADMIN | De su organización | De su organización | Denegado por defecto | De su organización | Vía funciones privilegiadas auditadas |
| COORDINATOR | De su organización | De su organización | Denegado | De su organización | Asignación vía funciones auditadas |
| PROFESSIONAL | Solo sus visitas | Solo pacientes con visita propia válida | Solo de sus visitas | Solo de sus visitas | No |
| AUDITOR | Denegado por defecto | Denegado | Denegado | Denegado | Solo eventos auditados |

Las categorías médico, enfermero, kinesiólogo, fonoaudiólogo, terapista ocupacional, nutricionista y cuidador profesional se modelan como especialidad, **no** como roles SQL que permitan leer cualquier paciente. No confundir cuidador profesional con responsable legal del paciente.

## Diseño de firma
1. La demostración existente de trazos permanece **in-memory** y no constituye consentimiento, conformidad legal ni firma digital.
2. Conformidad de un familiar: identidad, vínculo, autorización, resumen exacto de prestación, digest del documento, sello de tiempo, aceptación/negativa/ausencia y cadena de auditoría. Requiere validar legalmente su valor probatorio.
3. Firma digital del profesional: integración con prestador/certificador correspondiente según legislación argentina, verificación criptográfica y custodia de documento/versiones. Supabase **no** convierte un SVG/PNG en firma digital certificada.
4. No almacenar ni reutilizar una firma manuscrita del profesional automáticamente.

## Diseño de seguridad
- Los dispositivos usan únicamente **publishable/anon key** del proyecto + token de sesión del usuario. NUNCA introducir `service_role`, claves JWT, secretos, certificados privados ni contraseñas del servidor en app, GitHub o logs.
- Secretos del backend van en secretos de Supabase Edge Functions administrados por los responsables, fuera de Git.
- Esquema auxiliar `private` no expuesto en API. Funciones `security definer` con `search_path = ''` y nombres cualificados.
- Tablas sensibles con RLS habilitado y acceso a escritura **denegado por defecto** hasta implementar mutaciones auditadas.
- No permitir que quien ve visitas por rol administrativo vea automáticamente la evolución clínica.
- Evitar cachés duraderas de PHI y respaldos de trazos en el teléfono antes del diseño de cifrado/offline. Revocación de usuarios y pérdida de dispositivo son requisitos de producción.
- El almacenamiento de documentos y la residencia de datos exigen evaluación contractual, regulatoria, de recuperación ante desastres y retención.
- Nada de pacientes reales, scans, firmas, expedientes ni credenciales en el repositorio público.

## Primera implementación acotada (GATE SUPA-01)
- Migración SQL idempotente **solo para instalación única** en base vacía: tablas, claves foráneas con integridad de organización, índices, RLS y helpers de lectura.
- Sin altas automáticas ni datos de producción. Admin/Auth bootstrap será un gate posterior.
- Pruebas con PostgreSQL real ejecutadas en GitHub Actions mediante usuarios sintéticos: profesional asignado/no asignado, otra organización, coordinador, auditor, usuario inactivo, anon, denegación de escritura y FK cruzadas.
- No conectar la app móvil a la base hasta que pruebas de RLS, MFA/identidad y funciones de escritura hayan sido certificadas.

## Calidad/estado
Esta ADR registra arquitectura e invariantes; **no** crea automáticamente un proyecto Supabase en la nube ni concede cumplimiento legal. Habilitación clínica solamente después de migración desplegada, control externo de seguridad, UAT y revisión sanitaria.

Referencias oficiales:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/auth/sessions

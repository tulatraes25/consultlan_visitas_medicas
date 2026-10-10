# HC-02C1B — Solicitud de revisión de plan, solo PENDING

**SPEC/Kiro:** diseño e implementación sintética, antes de HC-02C2. Infraestructura de internación domiciliaria pediátrica completamente separada del sistema de consultorios. **NO se emite aprobación médica, orden, firma, ni activación de internación**.

## Necesidad
HC-02B crea metadatos de plan DRAFT sin una forma auditada de pedir su revisión. HC-02C1B incorpora únicamente un acto administrativo de solicitud y una cola restringida de metadatos; evita construir una aprobación ficticia sobre el frontend.

## Requisitos e invariantes
1. Las solicitudes pertenecen a organización, episodio y **versión exacta** de plan DRAFT; solo episodio DRAFT y plan DRAFT. No se reciben datos de salud, anexos, firmas, historia ni medicamentos.
2. Actor verificado por Edge Auth, con ADMIN/COORDINATOR activo en organización propia; la autorización definitiva ocurre otra vez en RPC SQL.
3. Identificador UUID de petición para reintentos serializados, evitar doble fila/auditoría. Dos claves distintas sobre la misma versión producen conflicto, no una segunda solicitud.
4. Solo existe estado PENDING; no hay transición a APPROVED ni a ACTIVE, ni permisos de escritura directos sobre la tabla. El rol de servicio llama una sola RPC, no puede hacer INSERT/UPDATE/DELETE directos.
5. RLS lectura: solo metadatos administrativos del propio ámbito. Ningún otro profesional, anónimo o externo ve cola de solicitudes.
6. Audit log sin contenidos clínicos, únicamente recurso, actor, organización y número de versión. Persistencia y migraciones separadas de CONSULTLAN.
7. API con allowlist fija y esquema estricto: la petición `requestHomecarePlanReview` acepta exclusivamente organizationId, episodeId, carePlanVersion y requestKey; no actor, roles, aprobaciones ni textos libres.
8. No habilitar botón de aprobación, notificación con datos de menores ni sincronización clínica real en la app.

## Diseño
- Migración: `supabase/migrations/20261010050000_homecare_review_requests.sql`.
- Tabla: `public.homecare_plan_review_requests` con PK UUID, FK a episodio y plan, unique org/request_key y episode/version, estado CHECK=PENDING.
- RPC: `api_hc_request_plan_review(p_actor,p_org,p_episode,p_version,p_request_key)` restringida a service_role, SQL calificado, search_path vacío, auditoría e idempotencia.
- Edge: entrada `requestHomecarePlanReview` (nunca `approveHomecareCarePlan`).
- Pruebas: `supabase/tests/homecare_plan_review_requests.sql` y `supabase/functions/visits/handler.test.ts`, incluidos en el Quality Gate, más Node/Expo existentes.

## Calidad y ataques negativos
- Rol administrativo legítimo puede solicitar una revisión de metadatos y reintentar sin repetir auditoría.
- Profesional ordinario, organización ajena, anónimo y sesión no verificada no pueden crear solicitudes.
- Duplicado por versión, reuso de request_key con diferente versión y episodio ya ACTIVE: bloqueo.
- service_role no puede modificar directamente estado de cola a APPROVED; el esquema mismo rechaza ese estado incluso para un superusuario.
- Plan y episodio permanecen DRAFT tras la solicitud. Ninguna de las nuevas pruebas ni rutas infiere autorización clínica.
- PR: auditar diff exacto; cuatro jobs CI con pasos revisados; merge normal y verificar CI posterior en main. No declarar listo para producción con solo Postgres sintético.

## Límite clínico-jurídico
HC-02C2 exigirá intervención humana identificada, habilitación profesional comprobada por fuente competente, consentimiento/representación según protocolo, plan realmente revisable e inmutable, trazabilidad y aprobación institucional legal/privacidad/seguridad; nada de eso se supone resuelto por este gate.

## Riesgos restantes
No hay proyecto Supabase staging real, identidad clínica verificable, almacenamiento de plan médico, circuito de autorización operativo, ni evidencia de firma. El esquema pendiente solo registra una petición de revisión estructural; no contiene material para juzgar el plan médicamente.

**Siguiente gate propuesto:** HC-02C1C — estado móvil de solicitud pendiente, solo demo sintética; o preparar staging Supabase independiente cuando el propietario habilite la infraestructura, siempre sin datos reales.

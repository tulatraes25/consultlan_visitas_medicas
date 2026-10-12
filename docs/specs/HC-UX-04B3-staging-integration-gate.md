# HC-UX-04B3 — Integración de planilla segura (solo staging)

SPEC/Kiro · 2026-10-12 · continuación de HC-UX-04B2 · issue #60

## Objetivo
Desde una cobertura **propia** autenticada, abrir con una acción únicamente la planilla que autoriza Edge/RPC, sin elegir especialidad, paciente o plantilla en el teléfono. Supabase independiente de CONSULTLAN ambulatorio. Primero seguridad y claridad para personal no técnico.

## Baseline
- HC-UX-04B2 implementó lector y controlador de sesión; permanecen sin conectar a `apps/mobile/App.tsx`.
- Los fixtures, casos y pacientes son sintéticos. No hay staging Supabase autorizado ni aprobación médica. Cualquier APP real es **NO-GO**.
- Issue #57: falta cotejo privado de planillas originales y expediente mensual. No se emiten PDFs ni firmas.

## Requisitos verificables
1. Staging exclusivo de internación domiciliaria, aprobado por la institución, región/retención/responsable definidos. Nunca reutilizar ref, token, credenciales ni datos de Pediatrics.
2. Dos organizaciones ficticias con usuarios y coberturas sintéticas. Migraciones y Edge verificadas según STAGING-01D/01E y STAGING-01F remoto.
3. Lista de ref prohibidas; URL exacta y `sb_publishable_*` pública. Rechazar `service_role`, `sb_secret_*` y configuración ausente **antes** de llamar Auth/red.
4. El `coverageId` proviene exclusivamente del roster propio autorizado por Edge; no se acepta desde deep links, URL arbitraria ni escritura manual.
5. El backend deriva identidad y permisos: el móvil transmite solo la acción fija y UUID de cobertura, nunca actor, organización, episodio, paciente, especialidad ni plantilla. El servidor revalida sesión viva, pertenencia de cobertura, episodio y plan válido.
6. Mostrar CTA único «Ver mi planilla». Estados legibles: sin sesión, sin asignación, verificando, vista estructural de solo lectura y sin autorización. No incluir UUID, PHI o trazas de Auth en pantalla.
7. En logout, refresh de token, cambio de usuario/cobertura, segundo plano y unmount, borrar inmediatamente la plantilla visible; descartar respuestas tardías. Sin almacenamiento offline ni fallback a demo fingiendo operación real.
8. Verificar en teléfono 390px y tablet 1280px, teclado y lector de pantalla; navegación coherente, sin selector manual de especialidad.

## Matriz de pruebas obligatorias
- Sin proyecto permitido o con secreto: rechazo local previo a red.
- JWT expirado o sesión revocada: sin plantilla.
- Profesional A consulta cobertura de B o de otra organización: 403/denegación sin datos.
- Cobertura elegible: únicamente uno de seis templates HC-03A sin PHI.
- Cobertura ambigua o especialidad no cubierta: bloqueo sin plantilla predeterminada.
- Respuesta enriquecida con PHI o campo adicional: rechazo completo.
- Logout, cambio de Auth, selección o app a segundo plano: vista vacía inmediatamente.
- RLS PostgreSQL, Edge Auth, TypeScript/Jest RN y browser QA: CI verde; pruebas remotas sintéticas de sesiones y dos organizaciones: PASS.

## Secuencia y gates
- A: preparar contrato/test offline sin montar cliente remoto en App.
- B: solo con autorización, Supabase staging autónomo y ejecución de runbook STAGING-01 con pruebas remotas.
- C: solo tras B aprobado, conectar roster autenticado a lector de una planilla y probar seguridad, CI y post-main.
- D (fuera de alcance): cotejo de documentos originales, autorización institucional/medicina legal para un flujo clínico y firmas.

**Estado actual: HC-UX-04B3-BLOCKED-REMOTE-STAGING.** Prohibido registrar pacientes reales o anunciar habilitación clínica por aprobar CI sintético.

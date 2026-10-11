# MOB-HC-PRO-01 — Vista ficticia de agenda propia por profesional

**SPEC/Kiro · 2026-10-11 · Expo teléfonos/tablets · offline · cero pacientes reales.**

## Problema y decisión

La plataforma de internación domiciliaria pediátrica atiende episodios longitudinales con profesionales de medicina, enfermería, kinesiología, fonoaudiología, terapia ocupacional y nutrición. El panel de Gestión visualiza varias especialidades, pero una persona que efectúa una visita debe consultar **sus propias coberturas**, no una suma indiscriminada de todo el servicio.

El backend HC-READ-01 ya establece la lectura mínima de agenda propia mediante Edge y `auth.sessions`, pero no hay un Supabase independiente desplegado ni credenciales de profesionales verificadas. Este gate implementa solo una **vista de rol de demostración**, sin atribuir identidad real al selector ni modificar el servidor.

## Requisitos

1. Dentro de Gestión, agregar módulo «Vista profesional» en teléfono/tablet. Selector de personas con ID `DEMO-PRO-...` y especialidad conocida. El selector solo cambia la perspectiva visual y lleva el aviso **SIN AUTENTICACIÓN · NO ES CONTROL DE ACCESO**.
2. La función pura `projectDemoOwnRoster` debe exigir coincidencia exacta `professionalRef` con el profesional ficticio elegido, y especialidad registrada coherente con la cobertura. Rechazar identidades y estados ajenos al catálogo, modalidades desconocidas y códigos de visita no sintéticos.
3. Cada prestación atribuida a ese profesional debe tener pareja `DEMO-PAT-<CÓDIGO>` / `DEMO-EPI-<CÓDIGO>` consistente, intervalo civil válido y duración máxima del prototipo. Si cualquier registro atribuido al profesional es inválido o duplicado, la proyección de esa agenda devuelve vacío (fail closed).
4. Ordenar cronológicamente, incluidas guardias nocturnas; mostrar referencia calculada desde ID DEMO, episodio, denominación sintética de paciente, modalidad `VISIT` o `SHIFT`, fecha/horario y estado de muestra. Nunca reflejar `patientLabel`, dirección, diagnóstico, narrativa, contacto, referencia externa ni nombre aportado por el cliente.
5. Estado vacío para profesionales sin coberturas o registros inválidos; cambiar de perspectiva quita las tarjetas anteriores. No hay botones de iniciar, confirmar, firmar, cancelar, registrar tratamiento ni acceder a un paciente verdadero.
6. La navegación `Gestión` de la demo permanece abierta deliberadamente a todas las identidades ficticias; **esto NO demuestra RBAC real ni autorización**. En producción el servidor decidirá profesional/rol/organización/episodio y no aceptará un identificador de profesional elegido por el móvil como prueba de acceso.

## Implementación y verificación

- `apps/mobile/src/professionalRosterDemo.ts`: validación de profesional DEMO, proyección saneada del roster y orden cronológico.
- `apps/mobile/src/ProfessionalRosterPreviewDemo.tsx`: selección ficticia con aviso y tarjetas de solo lectura.
- `apps/mobile/src/AdminWorkspaceDemo.tsx`: nueva sección `Vista profesional` accesible desde Gestión.
- `apps/mobile/__tests__/ProfessionalOwnRosterDemo.test.tsx`: aislamiento por profesional, identidades paciente/episodio, rechazo de filas corruptas, deduplicación, guardias nocturnas y etiquetas que no reflejan campos libres; navegación sin botones clínicos.
- Quality Gate 4/4: Node políticas de privacidad, PostgreSQL 16 RLS, Deno Auth/Edge y TypeScript/Jest/export JavaScript Android/iOS.

## NO-GO y próximos pasos

No guardar ninguna selección DEMO como rol o identidad real. Para activar una agenda personal vinculada a pacientes, STAGING-01F deberá certificar Supabase independiente, Auth, sesión activa/revocada, pertenencia a organización, matrícula/profesional habilitado, alcance por equipo y respuesta minimizada del RPC `api_hc_list_my_coverages`. No usar el backend Pediatrics de consultas ni importar su padrón.

**Siguiente gate:** `MOB-HC-SCOPE-02`: contrato de navegación profesional/coord. basado en un contexto autenticado proporcionado por servidor, sin usar el estado visual como autorización; requiere verificación de STAGING-01F antes de leer información real.

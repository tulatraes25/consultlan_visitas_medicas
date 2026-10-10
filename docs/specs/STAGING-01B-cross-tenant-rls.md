# STAGING-01B — RLS end-to-end con dos organizaciones sintéticas

**SPEC/Kiro.** Verificación únicamente de lectura, opcional y bloqueada hasta disponer de staging Supabase aislado y autorizado. Sin pacientes verdaderos, altas, modificaciones, firmas, aprobaciones, recetas ni despliegues.

## Problema
STAGING-01A solo comprueba acceso anónimo sin filas visibles. Una tabla vacía puede dar un resultado favorable aun con permisos equivocados. STAGING-01B exige **dos episodios ficticios existentes**, cada uno visible por un administrador/coordinar de su propia organización, y que ninguno pueda ver el episodio ajeno.

## Requisitos
1. Reutilizar la validación STAGING-01A de URL HTTPS exacta, referencia Supabase no prohibida, clave **publishable** y declaraciones del operador. `STAGING_RLS_E2E=YES`, `STAGING_SYNTHETIC_FIXTURES=YES` y `STAGING_ALLOW_NETWORK=YES` son obligatorios para solicitar red.
2. Recibir exclusivamente por variables de entorno del operador, sin archivos versionados: dos JWT de usuarios ficticios de ese Supabase; IDs UUID de esos usuarios, dos organizaciones diferentes y dos episodios distintos, más token JWT expresamente revocado de una cuenta ficticia.
3. Antes de probar la tabla, consultar `/auth/v1/user` con cada JWT y comprobar que el ID verificado coincide con el del fixture. Prohibir inferir identidad de claims del JWT sin verificación del servicio.
4. Pedir a REST `homecare_episodes?select=id,organization_id&id=eq.<uuid>` con cada cuenta. **Debe devolver exactamente una fila propia con id y organization_id coincidentes** (control positivo no vacío) y **cero filas del otro episodio** (control negativo). El usuario anónimo no debe poder ver el episodio propio ya probado como existente.
5. El token revocado se prueba contra `/auth/v1/user` y debe ser rechazado (401/403). No considerar revocación demostrada por no encontrar registros en una tabla.
6. Todas las peticiones GET, claves públicas, Authorization solo con JWT de prueba, `redirect:error`, `cache:no-store`, timeout 8s. Nunca escribir, ejecutar RPC, guardar cuerpos ni imprimir referencias, JWT, IDs, emails o datos médicos.
7. Denegar credenciales iguales, organización/episodios/usuarios iguales, IDs inválidos, destino sin aprobación, clave `sb_secret_`, JSON malformado, cualquier columna adicional a `id`, datos ajenos visibles y respuesta ambigua. No declarar éxito parcial.
8. `--ci`: **sin red**, tests Node con transporte simulado y casos positivos/negativos. `--check-env`: validación local, no prueba independencia. `--probe`: solo por invocación explícita del operador tras preparar staging.
9. Aun aprobando, **no** certifica acceso a notas clínicas, almacenamiento, firmas, consentimientos, evolución, relevo, procedimientos, matrícula médica ni aptitud de uso clínico.

## Diseño y tareas
- `src/operations/staging-rls-policy.mjs`: validación y test cruzado de lectura.
- `scripts/staging-rls-verify.mjs`: CLI independiente, sanitizada, no red por defecto.
- `test/staging-rls-policy.test.mjs`: deny by default, validación, lectura positiva no vacía, denegación cruzada, token revocado, rechazo de datos extra, ausencia de escritura.
- Quality Gate: tests en Node 22, más PostgreSQL, Deno y Expo existentes.
- Runbook institucional STAGING-01: anotar dependencias, no pedir al usuario tokens en el chat.

## Aceptación y riesgo
**READY_FOR_LIVE_STAGING_RLS_TEST** solo cuando código/CI GitHub pasen. **STAGING_RLS_VERIFIED** únicamente después de ejecutar `--probe` contra dos organizaciones sintéticas reales, una sesión revocada y auditar el entorno. No hay Supabase conectado actualmente, así que ese segundo estado seguirá pendiente.

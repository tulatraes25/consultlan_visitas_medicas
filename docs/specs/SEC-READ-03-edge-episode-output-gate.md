# SEC-READ-03 — Control de salida Edge para alcance de episodios

**SPEC/Kiro · 2026-10-12 · candidato sin despliegue remoto · datos únicamente sintéticos**

## Hallazgo

SEC-READ-02B protegió el acceso al episodio en SQL y revocó los SELECT directos de JWT. Sin embargo, `inspectMyHomecareEpisodeScope` todavía devolvía directamente al celular el `result.data` de un RPC con `service_role`. Si una migración futura añadiera identidad de paciente, diagnóstico, contacto o una segunda fila ajena al contrato, el dato viajaría por Edge aunque el SQL hubiera sido originalmente seguro. La salida de Edge es una frontera de seguridad independiente.

## Objetivo y requisitos

1. Conservar la acción y los parámetros actuales: solo `episodeId` UUID en el cuerpo; `p_actor` se deriva de Auth verificado y sesión viva.
2. Antes de serializar, aceptar **exactamente** `[]` o `[{id,organization_id}]`. La lista admite a lo sumo un episodio, sin atributos extra ni objetos anidados.
3. Ambos IDs son UUID; el `id` devuelto debe coincidir con el episodio solicitado, comparado sin diferencia de mayúsculas/minúsculas. Ninguna organización puede ser aportada ni elegida por el teléfono.
4. Frente a objetos alterados, campos PHI, múltiples filas, IDs ajenos, no-array o una respuesta SQL malformada, devolver **HTTP 502** y únicamente `{error:"DATA_OPERATION_FAILED"}`, sin reflejar valores del upstream.
5. Preservar el significado de `[]`: no revela si un episodio existe en otra organización; SQL debe seguir imponiendo organización/membresía/equipo, y una denegación SQL 42501 continúa como HTTP 403.
6. No alterar SQL histórico ni el conteo de **13 migraciones** hasta instalación supervisada. No insertar pacientes, subir archivos clínicos ni conectar Supabase.

## Verificación

- Deno HTTP positivo para `[]` y una fila de dos claves.
- Deno HTTP negativo para paciente/diagnóstico/firmas, campo adicional, organización/ID malformados, episodio distinto, lista duplicada, valores inesperados y suplantación de organización en el request.
- El cuerpo del error no contiene información privada y no cambia la política de sesión.
- Ejecutar los cinco trabajos CI del repositorio, merge normal a `main` y **Quality Gate posmerge** sobre el SHA exacto antes de `CLOSED_CERTIFIED`.

## NO-GO

La proyección de alcance nunca es una historia clínica, ni una autorización para emitir documentación o prestar atención. La ausencia de Supabase de staging autónomo autorizado y el cotejo privado de los documentos originales siguen bloqueando el uso con pacientes reales.

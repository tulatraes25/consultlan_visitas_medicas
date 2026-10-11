# WEB-COORD-01 — Especificación de consola web de coordinación

**Fecha:** 2026-10-11. **Estado:** SPEC/CONCEPTUAL, solo mocks sintéticos; no implementada. **Inspiración:** CONSULTLAN en diseño institucional; Folk Care en módulos; CommandCare en calendario semanal; CareShift (MIT) en cambios de guardia, aprobaciones y auditoría; Avni/CHT en tareas del trabajador; Medplum/OpenMRS en separación clínica. Consultar [OSS-HC-ARCH-01](../research/OSS-HC-ARCH-01-github-benchmark.md) y [ADR-004](../adr/ADR-004-benchmark-driven-homecare-platform.md).

## Objetivo

Diseñar un backoffice **web separado** para coordinar episodios domiciliarios, asignar médicos, enfermeros, kinesiólogos, fonoaudiólogos, terapeutas y cuidadores, resolver relevos y faltantes, revisar planes por autoridad clínica y gestionar evidencias administrativas. No reemplaza la app Android/iOS; comparte únicamente el futuro Supabase propio, una vez certificado.

## Audiencias y acceso mínimo

| Rol | Necesita ver/hacer | Debe quedar bloqueado por defecto |
| --- | --- | --- |
| Coordinación | Agenda operativa, disponibilidad, profesional asignado, episodio/cobertura, sustituciones, faltantes y alertas operativas | Diagnósticos completos, notas evolutivas, firmas clínicas |
| Dirección Médica | Cola de planes/órdenes a revisar y trazabilidad de decisiones autorizadas | Modificar sin justificación/versionado; aprobar sobre un mock |
| Profesionales de campo | Agenda y documentos propios en móvil | Otros episodios, otros equipos o búsqueda universal de pacientes |
| Administración | Alta administrativa autorizada, cobertura facturable y conciliación futura | Historial clínico, formularios médicos y órdenes por defecto |
| Auditoría | Evidencia de cambios, acciones, permisos y exportación bajo mandato específico | Operar como usuario clínico por ser auditor |
| Tutor/cuidador | En fase futura, acceso expresamente autorizado para su relación | Visualización de otros familiares o episodios |

## Pantallas a prototipar antes de implementar

1. **Panel de Coordinación / Hoy:** 4 indicadores sin diagnósticos (coberturas previstas, sin profesional, relevos pendientes, incidentes operativos por verificar), lista priorizada de acciones humanas y bloque de disponibilidad. Ningún número se presenta como hecho real en modo demo.
2. **Planificador semanal 24/7:** filas por profesional/rol, columnas día/horario, tarjetas diferenciadas para VISIT de corta duración y SHIFT nocturna; cola de no asignadas, filtros de especialidad y episodio, conflictos y huecos explícitos. Hora civil de servicio con zona IANA y offset cuando sea relevante.
3. **Episodio domiciliario:** pestañas Resumen, Coberturas, Equipo, Planes/versiones, Documentación autorizada, Incidencias y Auditoría; en vista operativa solo metadatos. El soporte físico en domicilio se indica sin simular copia digital del Kardex/hoja de crisis/controles.
4. **Profesionales:** especialidad, habilitación/credenciales por verificar, disponibilidad, límites de jornada acordados, vigencia de pertenencia al equipo y carga operativa. No determinar por algoritmo una habilitación profesional.
5. **Relevos y contingencias:** anterior/nuevo profesional, propuesta de intercambio con doble comprobación humana (solicitud y autorización), evento de entrega, hora, continuidad sin confirmar, faltantes de guardia y respuesta humana; incidentes críticos no sustituyen telefonía/circuito asistencial.
6. **Revisión clínica de planes:** lista por episodio/versión, estados de borrador y pendientes; acciones de aprobación **deshabilitadas** hasta definir Dirección Médica y normativa de firma.
7. **Rendición y reportes:** períodos, prestaciones, coberturas, documentación exigible por financiador, inconsistencias y exportación futura; separar facturable de clínicamente realizado.

## Tres estilos visuales comparables

| Estilo | Forma | Ventaja | Riesgo |
| --- | --- | --- | --- |
| A — CONSULTLAN institucional | Menú lateral verde oscuro, superficie blanco/gris, tablas compactas, barra de contexto | Consistencia visual con Pediatrics; sobriedad | Puede resultar demasiado orientado a consultorio |
| B — CommandCare operacional | Calendario con columnas y profesionales, cola lateral de asignaciones, tarjetas drag-and-drop simuladas | Muy legible para resolver turnos/relevos | Nunca trasladar mock de cambios locales a backend o considerar drag-and-drop una acción autorizada |
| C — Híbrido seleccionado | Tokens de CONSULTLAN + tablero operativo 24/7 y ficha de episodio caso-primero | Se alinea mejor con uso real domiciliario | Debe controlar densidad de información y privacidad |

**Recomendación a prototipar:** tres mockups de la misma jornada ficticia para comparar las tres alternativas. La opción C parte con ventaja, pero no se implementa sin ver los prototipos. Identidad visual: verdes auditados #166534 y #0B3D2A, fondos #F4F6F8 y #FFFFFF, texto #1F2937, estados con contraste y avisos textuales accesibles.

## Requisitos no funcionales y aceptación

- Diseño desktop prioritario con tablet responsive; el campo sigue usando Expo móvil.
- Mostrar claramente zona horaria, intervalos que cruzan medianoche y diferencias entre visita, guardia y relevo; no asumir bloques de 40 minutos de consultorio.
- La demo usa pacientes, profesionales, organizaciones y episodios **totalmente inventados**. Prohibido conectar servidor CONSULTLAN, pacientes ambulatorios, SICOM o datos reales.
- Componentes táctiles y teclado, contraste, foco visible, colores acompañados de texto, estados cargando/vacío/error, y navegación con pruebas automáticas.
- Un mismo evento no puede asociarse al episodio de otro paciente ni permitir cross-tenant; tests de permisos antes de integrar datos.
- No exponer información sanitaria sensible en tarjetas generales, logs, exportaciones, enlaces ni capturas de prototipos.
- El primer gate WEB-COORD-01A se considera satisfecho con tres mockups navegables sintéticos comparables y evaluación de usuarios de Coordinación, **sin backend**, sin estado clínico de producción.
- Prueba E2E de los flujos de planificación, visualización de huecos, cambio de especialidad y relevo sin pérdida de contexto. Luego, WEB-COORD-01B define componentes reales.

## Fuera de alcance del mockup

No implementar firmas, órdenes médicas, diagnóstico, dosificaciones, triage automático, geolocalización, sincronización offline, notificaciones urgentes ni lógica de sustitución clínica. No mostrar como disponible un proyecto Supabase staging todavía inexistente.

**Siguiente tarea atómica:** elaborar los tres mockups visuales de la consola web con la misma agenda sintética, hacer una evaluación funcional y seleccionar diseño antes del código.

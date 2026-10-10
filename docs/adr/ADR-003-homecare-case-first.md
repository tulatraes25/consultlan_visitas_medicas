# ADR-003 — Programa de internación domiciliaria pediátrica, centrado en el episodio asistencial

**Estado:** ACCEPTED para alcance/producto (2026-10-10); campos clínicos y circuitos pendientes de aprobación por la Dirección Médica.
**Sustituye el supuesto:** «agenda convencional de pacientes de consultorio».
**Complementa:** ADR-002 — instancia Supabase totalmente independiente de CONSULTLAN.

## Decisión de producto

El producto **no es una agenda de consultorio ni una réplica del sistema de la clínica Pediatrics**. Es una plataforma operativa específica para un programa de **internación y cuidados domiciliarios pediátricos**, con pacientes **distintos** de la población ambulatoria de Pediatrics; puede abarcar patologías graves, crónicas, oncológicas, neurológicas u otras necesidades de alta complejidad.

La aplicación es responsabilidad operativa de esta unidad de atención; conserva solamente la identidad visual de CONSULTLAN. No importa ni enlaza pacientes/turnos/historias de la clínica. Tampoco se debe asumir que todas las personas atendidas reciben cuidados paliativos: se modelan *necesidades y planes individuales*, determinados por profesionales competentes.

Los **datos de pruebas en GitHub son siempre sintéticos**. Si la unidad habilita el sistema para pacientes identificables, esa instancia tendrá su propio régimen de consentimiento, custodia, autorizaciones y protección reforzada de datos de salud de menores. No interpretar «sin pacientes de Pediatrics» como «sin información clínica sensible».

## Objeto principal: caso/episodio de internación domiciliaria

El centro del dominio pasa de `Visit` a `HomeCareEpisode` (un episodio longitudinal de atención). Las visitas y turnos se subordinan al episodio, no lo definen. Un paciente podría tener episodios sucesivos.

```text
Unidad domiciliaria (organización propia en Supabase)
└── Paciente del programa + responsables autorizados
    └── Episodio de internación domiciliaria
        ├── Admisión y consentimientos específicos
        ├── Médico responsable / coordinación asistencial
        ├── Plan de cuidados vigente, versiones y autorizaciones
        ├── Indicaciones y órdenes clínicas verificadas (no deducidas por la app)
        ├── Cobertura/turnos/guardias por profesional, relevos y ausencias
        ├── Visitas puntuales (médico, kinesio, fono, TO, nutrición...)
        ├── Evoluciones y constancias por profesional
        ├── Incidentes y escalamiento humano con acuse y trazabilidad
        ├── Referencia documental al material físico en el domicilio
        └── Egreso / reinternación / transferencia / cierre longitudinal
```

### Distinciones obligatorias

- `HomeCareEpisode`: ingreso, continuidad y egreso; no equivale a un turno.
- `CarePlanVersion`: objetivos, responsable que aprueba, período de vigencia y versión inmutable; borrador **no habilita** una indicación.
- `MedicalOrderVersion`: órdenes emitidas por profesional habilitado, con estado y responsable; **ninguna prescripción o dosis inferida o sugerida automáticamente**.
- `CareShift`: cobertura prolongada (por ejemplo turnos definidos por el prestador) y entrega de guardia; no forzar a una visita convencional de 40 minutos.
- `HomeVisit`: prestación/intervención acotada, asignada a paciente/episodio/profesional.
- `ShiftHandover`: pase de información entre profesionales de guardia con confirmación, sin sustituir la comunicación clínica.
- `CaregiverRelationship`: familiar/tutor/persona autorizada con alcance y vigencia; **no** confundir con profesional cuidador ni con un adulto presente sin facultades de representación.
- `ClinicalEvent`: incidente/contingencia documentada, con comunicación, acuse y resolución; **no** transforma la app en servicio de emergencias.
- `BedsidePaperRecord`: referencia a Kardex, hoja de crisis, signos vitales y control de procedimientos que permanecen en el domicilio; no fingir que la app reemplaza esos registros.
- `AttendanceAttestation`: conformidad sobre prestación brindada, diferente de consentimiento informado clínico y de firma digital del profesional.
- `Discharge`: egreso formal, transferencia o reinternación, sujeto a validación humana autorizada.

## Flujo operativo propuesto

1. **Admisión**: crear paciente nuevo en la base propia y episodio de internación con responsables, institución/obra social y referente asistencial, según lo que apruebe el responsable médico.
2. **Plan de cuidados**: definir y versionar plan e indicaciones por equipo clínico habilitado. Registrar quién lo aprueba y desde cuándo rige. Sin plan vigente, impedir registrar ejecución como «ordenada» salvo protocolos excepcionales formalmente aprobados.
3. **Coberturas**: coordinación programa guardias prolongadas y/o intervenciones acotadas; detectar solapamientos, faltantes y reemplazos sin inventar disponibilidad.
4. **Atención**: profesional con rol, habilitación y asignación válidos ve solo la información necesaria para la tarea, registra evolución y constancia individual; médico y enfermería comparten continuidad asistencial mediante permisos específicos, no por pertenecer a la misma organización.
5. **Incidentes**: registrar aviso, destinatario humano, fecha/hora, acuse y acciones; si hay gravedad, exhibir protocolo y canales asistenciales *previamente aprobados*, con advertencia de no depender de la app para urgencias. No diagnóstico, triage autónomo, dosificación ni notificación falsa de un médico.
6. **Documentación**: Kardex, signos vitales, procedimientos y hoja de crisis se conservan en domicilio de acuerdo con Pediatrics. Registrar solo lo digital aprobado; no declarar copiado completo del papel.
7. **Conformidad y firma**: separar presencia de familiar, capacidad de representación, firma electrónica de asistencia, consentimiento informado y firma digital profesional; cada una requiere verificación independiente.
8. **Conciliación**: reporte por episodio, profesional, especialidad, turno/visita, documentación y cobertura, sin lectura administrativa automática de la narrativa clínica.
9. **Egreso**: cierre del episodio con causal y responsable; no permitir nuevas atenciones en un caso egresado sin un nuevo episodio o corrección auditada.

## Diseño de datos, seguridad y compatibilidad

- Seguir usando Supabase **propio**, sin enlaces al backend de CONSULTLAN. `patient_id` es un UUID **local de este programa**, no un identificador de clínica.
- La tabla `visits` de SUPA-01/SUPA-02 es **legado del prototipo** hasta sumar `homecare_episodes` y las nuevas relaciones. No promocionar el actual flujo de visitas como producto asistencial completo.
- Restricción primaria propuesta para el modelo persistente: cada turno/visita debe referir a un episodio del mismo paciente y organización; las asignaciones clínicas deben estar activas durante la ejecución.
- Permisos de lectura clínica **por equipo de episodio y necesidad**: el modelo preliminar solo deja ver las notas propias al profesional asignado. El acceso compartido a un caso requiere una matriz aprobada por Dirección Médica y pruebas negativas RLS; no conceder por defecto al personal administrativo.
- Restringir información clínica de alta sensibilidad (diagnósticos, medicación, urgencias, imágenes) por rol, episodio, dispositivo y necesidad, con logs sin datos de salud.
- No implementar terapias recomendadas por IA, alertas clínicas automáticas con apariencia de monitoreo 24/7, ni órdenes médicas inferidas.
- El sistema debe tolerar falta de señal sin convertir registros offline o ausencia de recepción de avisos en supuesta prestación/urgencia atendida.

## Requisitos de autorización clínica

La ingeniería no define posología, umbrales críticos, criterios de internación/egreso, tratamientos o quién está habilitado para firmar. Todo eso requiere validación de la institución y de responsables clínicos, además de revisión legal/privacidad y de requisitos jurisdiccionales.

## Próximos gates en GitHub

**HC-00 (este gate):** especificación, nomenclatura, contrato de estado longitudinal y pruebas sin datos reales.

**HC-01:** esquema `homecare_episodes`, estados, pertenencia a organización/paciente, relaciones con visita y profesional, RLS, casos negativos en PostgreSQL. No inventar formularios médicos.

**HC-02:** coordinación de equipo, turnos extendidos y relevos, situaciones de cobertura incompleta, plan versionado y bloqueo de acciones no autorizadas.

**HC-03:** formularios por especialidad contra FORM-001, diferenciación de asistencia/evolución/cuidado continuo y referencia a material físico del domicilio. Pendiente aprobación médica.

**HC-04+:** firmas, contingencias, exportaciones, auditoría y control de dispositivos; primero CI GitHub, luego staging Supabase separado y validación clínica.

## Referencias para revisión normativa y técnica (no constituyen dictamen legal)

- Argentina, **Resolución MS 704/2000**, normas para servicios de internación domiciliaria; organización, interdisciplina, documentación y derivación: https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-704-2000-64241/texto
- Argentina, **Resolución MS 374/2002**, guías de procedimientos de enfermería y kinesiología en internación domiciliaria: https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-374-2002-75750/texto
- American Academy of Pediatrics, coordinación y planes de cuidados para niños con necesidades complejas en hogar: https://publications.aap.org/pediatrics/article/129/5/996/73753/Home-Care-of-Children-and-Youth-With-Complex
- OMS, cuidados paliativos pediátricos centrados en familia y equipo (aplicable **solo** cuando un paciente requiera esa modalidad): https://www.who.int/europe/news-room/fact-sheets/item/palliative-care-for-children

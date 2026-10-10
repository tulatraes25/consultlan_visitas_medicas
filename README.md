# CONSULTLAN Visitas Médicas

Proyecto nuevo de Pediatrics para **registro y gestión de prestaciones domiciliarias**, orientado a teléfonos y tablets. **Estado: especificación y contratos técnicos; NO existe una aplicación clínica operativa ni un despliegue productivo.**

## Funcionalidad prevista
- Agenda y pacientes asignados para medicina, enfermería/cuidadores, kinesiología, fonoaudiología, terapia ocupacional y nutrición.
- Registro clínico y constancia administrativa de asistencia **separados**.
- Conformidad de familiar/tutor o constancia auditable de negativa/indisponibilidad.
- Firma profesional digital **solo** cuando se haya integrado y verificado prestador/certificado legalmente adecuado; un dibujo o sello no constituye por sí mismo firma digital.
- Uso en domicilios con conexión débil: borradores offline cifrados y confirmación/cierre solo desde el servidor.
- Diseño móvil con los tokens institucionales reales de CONSULTLAN/Pediatrics (#166534, #0B3D2A).

## Estructura actual
- [SPEC-001](docs/specs/SPEC-001-visitas-domiciliarias.md): requisitos y criterios de aceptación.
- [FORM-001](docs/specs/FORM-001-inventario-clinico.md): inventario de formularios **sin datos de pacientes**.
- [ADR-001](docs/adr/ADR-001-mobile-clinical-records-signatures.md): separación de registros, seguridad, firmas y alternativas de arquitectura.
- [Contrato OpenAPI](contracts/openapi.visits.json): borrador de endpoints, no servidor desplegado.
- [Reglas de dominio](src/domain/visit-policy.mjs): autorización por rol, organización, asignación y transiciones.
- [Pruebas](test/): controles negativos de acceso, estados, firmas y contrato de API.
- [Quality Gate](.github/workflows/quality-gate.yml): pruebas Node 22 y bloqueo de adjuntos clínicos fuente.

## Validación técnica
```bash
npm test
```
No hay dependencias externas para ejecutar estas pruebas de especificación. No presupone backend, BD ni aplicación móvil instalados.

## Privacidad y límites
Repositorio público: **prohibido** incorporar historias clínicas, expedientes escaneados, imágenes de firmas, documentos originales, nombres/DNI de pacientes, claves o dumps. Las pruebas contienen exclusivamente datos sintéticos.

El núcleo de dominio no reemplaza middleware de autenticación, autorizaciones transaccionales, gestión segura de firmas, almacenamiento cifrado ni asesoramiento legal sanitario. Los campos clínicos y políticas aún necesitan aprobación de Pediatrics. CONSULTLAN productivo no debe modificarse por este repositorio sin contrato de integración aprobado.

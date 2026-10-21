# WEB-COORD-06 — Firma manuscrita táctil, tablet y birome capacitiva (solo demo)

**SPEC/Kiro · 2026-10-21 · GitHub-first · no-go clínico**

## Decisión de producto
- **Tablets primero**, teléfonos compatibles y escritorio como acceso secundario.
- El usuario podrá dibujar dentro de **un recuadro amplio** directamente sobre la pantalla táctil.
- Debe servir con **el dedo** o una **birome capacitiva pasiva universal** que imita el contacto del dedo. No depender de Apple Pencil, S Pen, un digitalizador activo, Bluetooth, emparejamiento, batería, presión o inclinación.
- Puede funcionar también con un lápiz activo cuando la tablet lo admita, pero **no es un requisito**. Probar físicamente la birome económica en la tablet adquirida: precisión, rechazo accidental de palma, protección de pantalla, comodidad y latencia varían según el dispositivo.
- Firma del profesional y conformidad del cuidador/representante **son conceptos diferentes**. El profesional se identifica mediante autenticación y rol, y la legitimación del representante debe verificarse; no basta con dibujar trazos.

## Alcance concreto de este PR
1. Mantener la demo React Native/Expo con trazos temporales y ampliar su superficie de 180 px a **270 px en tablets >=700 px**, 200 px en móviles, hasta 760 px de ancho del cuadro modal.
2. Agregar a apps/web una **práctica interactiva** desde Control documental, con cuadro HTML Canvas grande, eventos Pointer Events para mouse/touch/pen, touch-action:none, trazos visibles y botón **Borrar y volver a dibujar**.
3. Dos roles de práctica independientes (profesional / responsable o cuidador autorizado), vaciado al cambiar el rol.
4. Al cerrar/reabrir se **descartan todos los trazos**. Cambio de tamaño/orientación también borra. No se serializa a DataURL, no se guarda ni transmite.
5. El usuario ve avisos inequívocos de **sin validez legal, no firmar nombre real**, sin identidad comprobada, sin firma clínica, sin completar pendientes mensuales y sin habilitar expediente.
6. Acceso táctil claro, botones de 44 px o más, apertura/cierre mediante diálogo accesible, layouts 320/390/768/1440 px, orientación vertical y horizontal.
7. Pruebas E2E de abrir modal, arrastrar con mouse y tocar con touch simulado en Chrome tablet, borrar, cambiar de rol, cerrar, reabrir en blanco, no modificar métricas ni abrir exportación; Firefox/WebKit, WCAG, cero solicitudes HTTP. RN Jest comprueba cuadro grande en modo tablet y descarte.

## Fuera de alcance / protección clínica
**El gesto de dibujar no constituye por sí mismo una firma digital legalmente válida en Argentina.** No equivale a firma validada del profesional, consentimiento de cuidador o prueba de prestación. Antes de registrar firmas reales: acuerdo con Laura/Pediatrics, identificación y representación comprobadas, atribución documental y de cada firmante, fecha/hora confiables, huella del documento y asociación segura con el episodio, auditoría inmutable, correcciones por adenda, conservación/entrega legal y revisión jurídica de firma electrónica/digital aplicable. Supabase real permanece desconectado; ningún paciente o trazo real se usa en CI.

## Quality Gate
Rama corta + PR + cinco trabajos de CI (incluido React Native Jest, bundle Expo Android/iOS y browser Chrome/Firefox/WebKit) y CI posmerge en SHA exacto. Sin commits directos a main. Esta demo es material para enseñar, no para operar.

# MOB-AUTH-01 — Suscripción obligatoria a eventos de Auth para la agenda de staging

**SPEC/Kiro · 2026-10-11 · código mobile solo de staging ficticio · NO hay proveedor Supabase real conectado.**

## Hallazgo

MOB-DATA-02 limpia una agenda bajo petición `clear()`, al abandonar la pantalla y en segundo plano. La desconexión por logout/cambio de cuenta, sin embargo, dependía de que el integrador recordase invocar ese método. La autorización Edge valida sesiones nuevas, pero un cliente con datos previamente renderizados debe retirarlos en el momento del evento de Auth.

## Requisitos

1. La vista de staging requiere un objeto similar a `supabase.auth` del **proyecto independiente** que exponga `onAuthStateChange` y permita cancelar la suscripción. El código **no incluye SDK, credenciales ni un Supabase configurado**. El proyecto ambulatorio de Pediatrics no debe utilizarse.
2. Al incorporar o cambiar el proveedor se borran las coberturas existentes antes de registrar un listener. Si falta una función válida o no se obtiene `subscription.unsubscribe`, fallar cerrado con error fijo `ROSTER_AUTH_EVENTS_UNAVAILABLE`, sin imprimir la respuesta ni el contenido de una sesión.
3. Cualquier evento de Auth (incluidos `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`, `USER_UPDATED`, `SIGNED_OUT` o eventos futuros no reconocidos) causa limpieza y aborto inmediato. No basar permisos de backend en el texto del evento ni en el estado React.
4. Al desmontar la pantalla, desuscribirse, cancelar solicitudes y vaciar filas. Una llamada de evento posterior a desuscripción no debe mutar el controlador. Conservar el resto de reglas de 01D/01E/01F y MOB-DATA-01/02/03.
5. Un token se toma del proveedor únicamente durante la solicitud, no se registra en el snapshot, interfaz, archivos, AsyncStorage ni logs. El control que otorga o revoca acceso real continúa en Supabase Auth, Edge validando sesión viva y RPC con alcance por organización/episodio/profesional.
6. La pantalla sigue **sin montarse en App.tsx**, ni automatiza login, consulta, creación de usuarios o prestaciones. Únicamente se hace consulta con intervención del operador de staging ya autorizado.

## Archivos y verificación

- `apps/mobile/src/coverageAuthEvents.ts`: adaptador mínimo y testeable para `onAuthStateChange`, limpieza al suscribirse/evento/retirarse; sin SDK instalado.
- `apps/mobile/src/StagingOwnRosterPreview.tsx`: parámetro obligatorio `authEvents` y suscripción React controlada.
- `apps/mobile/__tests__/CoverageAuthEvents.test.tsx`: todos los eventos, sesión cerrada durante solicitud, evento tardío, proveedor inválido, desacople al desmontar y ausencia de exposición de secretos.
- `apps/mobile/__tests__/CoverageSessionController.test.tsx`: pantalla de staging con proveedor ficticio explícito.
- GitHub Quality Gate: Node, PostgreSQL, Deno, Expo TypeScript/Jest y bundles JS Android/iOS.

## NO-GO

La suscripción local a Auth **no certifica** vigencia de un JWT, pertenencia a un equipo clínico, estado de profesionales ni derechos de acceso. Ningún paciente real, fecha de tratamiento, prescripción o firma podrá usarse hasta completar STAGING-01F-REMOTE en un Supabase nuevo y autorización institucional, técnica, médica y jurídica.

**Siguiente paso:** integrar formalmente un proveedor Supabase Auth exclusivo en staging autorizado y comprobar con tokens sintéticos la cadena sesión viva/revocada→Edge→RPC→cliente. Antes de ello permanecerá como componente aislado, no producción.

-- SUPA-04B: retire legacy clinical prototype RPC permissions after SUPA-04
-- Edge command lockdown. Run after SUPA-02/HC-02C1B migration chain.
-- Keep functions for historic regression tests, but do not expose to service_role.
-- No clinical permissions, order validation, or patient data added.

revoke execute on function public.api_schedule_visit(
  uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid) from service_role;
revoke execute on function public.api_begin_visit(uuid,uuid,uuid) from service_role;
revoke execute on function public.api_add_clinical_note(
  uuid,uuid,uuid,text,uuid) from service_role;
revoke execute on function public.api_submit_visit_review(
  uuid,uuid,uuid) from service_role;
revoke execute on function public.api_cancel_visit(
  uuid,uuid,uuid,text) from service_role;

comment on function public.api_schedule_visit(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid)
  is 'SUPA-04B: historical proto RPC, EXECUTE revoked from service_role. Use homecare roster only.';
comment on function public.api_begin_visit(uuid,uuid,uuid)
  is 'SUPA-04B: historical proto RPC disabled for backend calls pending medical authorization.';
comment on function public.api_add_clinical_note(uuid,uuid,uuid,text,uuid)
  is 'SUPA-04B: historical clinical text RPC disabled for backend calls pending privacy and medical authorization.';
comment on function public.api_submit_visit_review(uuid,uuid,uuid)
  is 'SUPA-04B: obsolete review RPC disabled; homecare review intake is separate and PENDING only.';
comment on function public.api_cancel_visit(uuid,uuid,uuid,text)
  is 'SUPA-04B: obsolete cancellation RPC disabled pending new authorized homecare cancellation flow.';

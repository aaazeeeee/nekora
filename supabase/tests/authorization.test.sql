begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','owner@draftly.test'),
 ('00000000-0000-0000-0000-000000000002','editor@draftly.test'),
 ('00000000-0000-0000-0000-000000000003','viewer@draftly.test'),
 ('00000000-0000-0000-0000-000000000004','stranger@draftly.test');
insert into public.documents(id,owner_id,title) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Private draft');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select is((select count(*)::integer from public.documents),0,'Private document is invisible to stranger');
select is((select count(*)::integer from public.profiles),1,'Only own profile is visible');
select throws_ok($$select public.save_document('10000000-0000-0000-0000-000000000001',0,'Attack','{"type":"doc"}')$$,'42501',null,'Stranger cannot save');
select throws_ok($$select public.share_document('10000000-0000-0000-0000-000000000001','stranger@draftly.test','editor')$$,'42501',null,'Stranger cannot self-grant');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.share_document('10000000-0000-0000-0000-000000000001','editor@draftly.test','editor')$$,'Owner grants editor access');
select lives_ok($$select public.share_document('10000000-0000-0000-0000-000000000001','viewer@draftly.test','viewer')$$,'Owner grants viewer access');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select is((select count(*)::integer from public.documents),1,'Editor can read');
select is(public.save_document('10000000-0000-0000-0000-000000000001',0,'Saved draft','{"type":"doc"}'),1,'Editor saves with atomic revision');
select is((select title from public.documents limit 1),'Saved draft','Content persists');
select throws_ok($$select public.save_document('10000000-0000-0000-0000-000000000001',0,'Stale','{"type":"doc"}')$$,'40001',null,'Stale revision rejected');
select throws_ok($$update public.documents set owner_id='00000000-0000-0000-0000-000000000002'$$,'42501',null,'Editor cannot take ownership');
select throws_ok($$select public.share_document('10000000-0000-0000-0000-000000000001','stranger@draftly.test','editor')$$,'42501',null,'Editor cannot share');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select is((select count(*)::integer from public.documents),1,'Viewer can read');
select throws_ok($$select public.save_document('10000000-0000-0000-0000-000000000001',1,'Attack','{"type":"doc"}')$$,'42501',null,'Viewer cannot save');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.revoke_document_access('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')$$,'Owner revokes access');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select is((select count(*)::integer from public.documents),0,'Revoked editor loses read access');
set local role anon;
select throws_ok($$select * from public.documents$$,'42501',null,'Anonymous reads rejected');
select * from finish();
rollback;

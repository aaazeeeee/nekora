begin;
create table public.document_access_requests (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);
alter table public.document_access_requests enable row level security;
revoke all on public.document_access_requests from public, anon, authenticated;

create function public.request_document_access(doc_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.documents where id=doc_id for update;
  -- Give the same response for missing documents, without revealing their existence.
  if not found then return; end if;
  if public.document_access(doc_id) is not null then return; end if;
  insert into public.document_access_requests(document_id,user_id) values(doc_id,auth.uid()) on conflict do nothing;
end; $$;

create function public.list_document_access_requests(doc_id uuid)
returns table(user_id uuid, display_name text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.document_access(doc_id) is distinct from 'owner' then raise exception 'Only the owner can manage requests' using errcode='42501'; end if;
  return query select p.id,p.display_name,p.email from public.document_access_requests r
  join public.profiles p on p.id=r.user_id
  where r.document_id=doc_id and not exists (select 1 from public.document_shares s where s.document_id=doc_id and s.user_id=r.user_id)
  order by r.created_at;
end; $$;

create function public.resolve_document_access_request(doc_id uuid, recipient_id uuid, access_level public.document_permission default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.documents where id=doc_id for update;
  if public.document_access(doc_id) is distinct from 'owner' then raise exception 'Only the owner can manage requests' using errcode='42501'; end if;
  delete from public.document_access_requests where document_id=doc_id and user_id=recipient_id;
  if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
  if access_level is not null then
    insert into public.document_shares(document_id,user_id,permission) values(doc_id,recipient_id,access_level)
    on conflict(document_id,user_id) do update set permission=excluded.permission;
  end if;
end; $$;
revoke execute on function public.request_document_access(uuid), public.list_document_access_requests(uuid), public.resolve_document_access_request(uuid,uuid,public.document_permission) from public, anon;
grant execute on function public.request_document_access(uuid), public.list_document_access_requests(uuid), public.resolve_document_access_request(uuid,uuid,public.document_permission) to authenticated;
commit;

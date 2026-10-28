-- Lifecycle/CAS conflicts are application errors, not retryable PostgreSQL
-- serialization failures. PostgREST may retry 40001, delaying the response.
begin;
create or replace function public.initialize_collaboration(doc_id uuid, expected_revision integer, initial_state text)
returns setof public.document_collaboration language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.documents where id = doc_id for update;
  if not found then raise exception 'Document unavailable' using errcode='P0002'; end if;
  if not exists(select 1 from public.document_collaboration where document_id=doc_id) then
    if not exists(select 1 from public.documents where id=doc_id and revision=expected_revision) then
      raise exception 'Document changed during initialization' using errcode='55000';
    end if;
    insert into public.document_collaboration(document_id,state) values(doc_id,initial_state);
  end if;
  return query select * from public.document_collaboration where document_id=doc_id;
end; $$;

create or replace function public.store_collaboration(doc_id uuid, expected_version integer, next_state text, doc_title text, doc_content jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_version integer;
begin
  perform 1 from public.documents where id=doc_id for update;
  update public.document_collaboration set state=next_state,version=version+1
    where document_id=doc_id and version=expected_version returning version into next_version;
  if next_version is null then raise exception 'Collaboration state changed on another server' using errcode='55000'; end if;
  update public.documents set title=btrim(doc_title),content=doc_content,revision=revision+1,updated_at=clock_timestamp() where id=doc_id;
  return next_version;
end; $$;

create or replace function public.save_document(doc_id uuid, expected_revision integer, doc_title text, doc_content jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
  perform 1 from public.documents where id=doc_id for update;
  if coalesce(public.document_access(doc_id),'') not in ('owner','editor') then
    raise exception 'Document unavailable or read-only' using errcode='42501';
  end if;
  if exists(select 1 from public.document_collaboration where document_id=doc_id) then
    raise exception 'Open this document in the collaborative editor before saving.' using errcode='55000';
  end if;
  update public.documents set title=btrim(doc_title),content=doc_content,revision=revision+1,updated_at=clock_timestamp()
    where id=doc_id and revision=expected_revision returning revision into next_revision;
  if next_revision is null then raise exception 'Document changed in another session. Reload before saving.' using errcode='40001'; end if;
  return next_revision;
end; $$;
commit;

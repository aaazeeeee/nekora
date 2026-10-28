begin;
create type public.document_permission as enum ('editor', 'viewer');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  email text not null,
  created_at timestamptz not null default now()
);
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled document' check (char_length(btrim(title)) between 1 and 200),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_content check (jsonb_typeof(content) = 'object' and coalesce(content->>'type' = 'doc', false) and octet_length(content::text) <= 2097152)
);
create table public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission public.document_permission not null,
  created_at timestamptz not null default now(),
  unique(document_id, user_id)
);
create index documents_owner_idx on public.documents(owner_id, updated_at desc);
create index shares_user_idx on public.document_shares(user_id, document_id);
create index profiles_email_idx on public.profiles(lower(email));

create function public.sync_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, email)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), 'Writer'),100), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function public.sync_profile();
insert into public.profiles(id, display_name, email)
select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'), ''), split_part(email,'@',1),'Writer'),100), email from auth.users where email is not null;

create function public.document_access(doc_id uuid) returns text language sql stable security definer set search_path = '' as $$
  select case when d.owner_id = auth.uid() then 'owner' else s.permission::text end
  from public.documents d left join public.document_shares s on s.document_id = d.id and s.user_id = auth.uid()
  where d.id = doc_id and (d.owner_id = auth.uid() or s.user_id = auth.uid());
$$;
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_shares enable row level security;
create policy own_profile on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy accessible_documents on public.documents for select to authenticated using (public.document_access(id) is not null);
create policy own_shares on public.document_shares for select to authenticated using (user_id = (select auth.uid()) or public.document_access(document_id) = 'owner');
-- All writes go through narrow RPCs; neither editors nor owners may update protected columns directly.
revoke all on public.profiles, public.documents, public.document_shares from anon, authenticated;
grant select on public.profiles, public.documents, public.document_shares to authenticated;

create function public.list_documents() returns table (
 id uuid, owner_id uuid, title text, revision integer, created_at timestamptz, updated_at timestamptz, owner_name text, permission text
) language sql stable security definer set search_path = '' as $$
 select d.id,d.owner_id,d.title,d.revision,d.created_at,d.updated_at,p.display_name,public.document_access(d.id)
 from public.documents d join public.profiles p on p.id=d.owner_id
 where public.document_access(d.id) is not null order by d.updated_at desc;
$$;
create function public.create_document(doc_title text, doc_content jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 insert into public.documents(owner_id,title,content) values(auth.uid(),btrim(doc_title),doc_content) returning id into new_id;
 return new_id;
end; $$;
create function public.save_document(doc_id uuid, expected_revision integer, doc_title text, doc_content jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
 -- Lock document first: save and sharing changes serialize on the same row.
 perform 1 from public.documents where id=doc_id for update;
 if coalesce(public.document_access(doc_id),'') not in ('owner','editor') then
   raise exception 'Document unavailable or read-only' using errcode='42501';
 end if;
 update public.documents set title=btrim(doc_title),content=doc_content,revision=revision+1,updated_at=clock_timestamp()
 where id=doc_id and revision=expected_revision returning revision into next_revision;
 if next_revision is null then raise exception 'Document changed in another session. Reload before saving.' using errcode='40001'; end if;
 return next_revision;
end; $$;
create function public.share_document(doc_id uuid, recipient_email text, access_level public.document_permission)
returns void language plpgsql security definer set search_path = '' as $$
declare recipient_id uuid;
begin
 perform 1 from public.documents where id=doc_id for update;
 if public.document_access(doc_id) is distinct from 'owner' then raise exception 'Only the owner can share' using errcode='42501'; end if;
 select id into recipient_id from public.profiles where lower(email)=lower(btrim(recipient_email)) limit 1;
 if recipient_id is null then raise exception 'No account with that email' using errcode='P0002'; end if;
 if recipient_id=auth.uid() then raise exception 'The owner already has access' using errcode='22023'; end if;
 insert into public.document_shares(document_id,user_id,permission) values(doc_id,recipient_id,access_level)
 on conflict(document_id,user_id) do update set permission=excluded.permission;
end; $$;
create function public.revoke_document_access(doc_id uuid, recipient_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.documents where id=doc_id for update;
 if public.document_access(doc_id) is distinct from 'owner' then raise exception 'Only the owner can revoke access' using errcode='42501'; end if;
 delete from public.document_shares where document_id=doc_id and user_id=recipient_id;
end; $$;
create function public.list_document_shares(doc_id uuid) returns table(user_id uuid,display_name text,email text,permission text)
language plpgsql stable security definer set search_path = '' as $$
begin
 if public.document_access(doc_id) is distinct from 'owner' then raise exception 'Only the owner can manage access' using errcode='42501'; end if;
 return query select p.id,p.display_name,p.email,s.permission::text from public.document_shares s join public.profiles p on p.id=s.user_id where s.document_id=doc_id order by s.created_at;
end; $$;
-- Functions are executable by PUBLIC by default. Explicitly close that default.
revoke execute on function public.sync_profile(), public.document_access(uuid), public.list_documents(), public.create_document(text,jsonb), public.save_document(uuid,integer,text,jsonb), public.share_document(uuid,text,public.document_permission), public.revoke_document_access(uuid,uuid), public.list_document_shares(uuid) from public, anon;
grant execute on function public.document_access(uuid), public.list_documents(), public.create_document(text,jsonb), public.save_document(uuid,integer,text,jsonb), public.share_document(uuid,text,public.document_permission), public.revoke_document_access(uuid,uuid), public.list_document_shares(uuid) to authenticated;
commit;

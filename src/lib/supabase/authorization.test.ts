// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
const owner = '00000000-0000-0000-0000-000000000001';
const editor = '00000000-0000-0000-0000-000000000002';
const viewer = '00000000-0000-0000-0000-000000000003';
const stranger = '00000000-0000-0000-0000-000000000004';
const doc = '10000000-0000-0000-0000-000000000001';
let db: PGlite;
async function identity(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function scalar(sql: string) {
  return (await db.query<{ value: unknown }>(sql)).rows[0]?.value;
}
describe('PostgreSQL migration and authorization (embedded PostgreSQL, Supabase auth stubs)', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
    );
    await db.exec(
      await readFile(
        new URL(
          '../../../supabase/migrations/202610280001_draftly.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          '../../../supabase/migrations/202610280002_access_requests.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          '../../../supabase/migrations/202610280003_collaboration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          '../../../supabase/migrations/202610280004_collaboration_conflicts.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    await db.exec(
      `insert into auth.users(id,email) values ('${owner}','owner@draftly.test'),('${editor}','editor@draftly.test'),('${viewer}','viewer@draftly.test'),('${stranger}','stranger@draftly.test');insert into public.documents(id,owner_id,title) values ('${doc}','${owner}','Private draft');`,
    );
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  it('denies private reads and self-grants and limits profile disclosure', async () => {
    await identity(stranger);
    expect(
      await scalar('select count(*)::integer as value from public.documents'),
    ).toBe(0);
    expect(
      await scalar('select count(*)::integer as value from public.profiles'),
    ).toBe(1);
    expect(
      await scalar(
        'select count(*)::integer as value from public.list_documents()',
      ),
    ).toBe(0);
    await expect(
      db.query(
        `select public.share_document('${doc}','stranger@draftly.test','editor')`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query(
        `select public.save_document('${doc}',0,'Attack','{"type":"doc"}')`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('lets owners grant and inspect access without granting editors those powers', async () => {
    await identity(owner);
    await db.exec(
      `select public.share_document('${doc}','editor@draftly.test','editor');select public.share_document('${doc}','viewer@draftly.test','viewer');`,
    );
    expect(
      await scalar(
        `select count(*)::integer as value from public.list_document_shares('${doc}')`,
      ),
    ).toBe(2);
    await identity(editor);
    expect(
      await scalar('select count(*)::integer as value from public.documents'),
    ).toBe(1);
    await expect(
      db.query(
        `select public.share_document('${doc}','stranger@draftly.test','editor')`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query(`select public.list_document_shares('${doc}')`),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query(`select public.revoke_document_access('${doc}','${viewer}')`),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('persists editor changes with atomic revision checks and protects ownership', async () => {
    await identity(editor);
    expect(
      await scalar(
        `select public.save_document('${doc}',0,'Saved draft','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Persisted"}]}]}') as value`,
      ),
    ).toBe(1);
    expect(
      await scalar(
        `select title as value from public.documents where id='${doc}'`,
      ),
    ).toBe('Saved draft');
    expect(
      await scalar(
        `select content#>>'{content,0,content,0,text}' as value from public.documents where id='${doc}'`,
      ),
    ).toBe('Persisted');
    await expect(
      db.query(
        `select public.save_document('${doc}',0,'Stale','{"type":"doc"}')`,
      ),
    ).rejects.toMatchObject({ code: '40001' });
    await expect(
      db.query(
        `update public.documents set owner_id='${editor}' where id='${doc}'`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query(
        `insert into public.document_shares(document_id,user_id,permission) values('${doc}','${stranger}','editor')`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('allows viewer reads but denies writes', async () => {
    await identity(viewer);
    expect(
      await scalar('select count(*)::integer as value from public.documents'),
    ).toBe(1);
    await expect(
      db.query(
        `select public.save_document('${doc}',1,'Attack','{"type":"doc"}')`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('immediately denies subsequent reads and writes after owner revokes access', async () => {
    await identity(owner);
    await db.exec(`select public.revoke_document_access('${doc}','${editor}')`);
    await identity(editor);
    expect(
      await scalar('select count(*)::integer as value from public.documents'),
    ).toBe(0);
    await expect(
      db.query(
        `select public.save_document('${doc}',1,'Revoked','{"type":"doc"}')`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('rejects anonymous table access and RPC execution', async () => {
    await db.exec('reset role;set role anon;');
    await expect(
      db.query('select * from public.documents'),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query('select public.list_documents()'),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('keeps requests private and requires owner approval before access', async () => {
    await identity(stranger);
    await db.exec(
      `select public.request_document_access('${doc}'); select public.request_document_access('${doc}');`,
    );
    expect(
      await scalar(`select public.document_access('${doc}') as value`),
    ).toBeNull();
    await expect(
      db.query(`select public.list_document_access_requests('${doc}')`),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query(
        `select public.resolve_document_access_request('${doc}','${stranger}','editor')`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query('select * from public.document_access_requests'),
    ).rejects.toMatchObject({ code: '42501' });
    await identity(owner);
    expect(
      await scalar(
        `select count(*)::integer as value from public.list_document_access_requests('${doc}')`,
      ),
    ).toBe(1);
    await db.exec(
      `select public.resolve_document_access_request('${doc}','${stranger}',null)`,
    );
    await identity(stranger);
    expect(
      await scalar(`select public.document_access('${doc}') as value`),
    ).toBeNull();
    await db.exec(`select public.request_document_access('${doc}')`);
    await identity(owner);
    await db.exec(
      `select public.resolve_document_access_request('${doc}','${stranger}','viewer')`,
    );
    await identity(stranger);
    expect(
      await scalar(`select public.document_access('${doc}') as value`),
    ).toBe('viewer');
    await expect(
      db.query(
        `select public.save_document('${doc}',1,'Denied','{"type":"doc"}')`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await identity(owner);
    await db.exec(
      `select public.revoke_document_access('${doc}','${stranger}')`,
    );
    await db.exec('reset role;set role anon;');
    await expect(
      db.query(`select public.request_document_access('${doc}')`),
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('validates titles/content in the database and lets owners create', async () => {
    await identity(owner);
    await expect(
      db.query(`select public.create_document('','{"type":"doc"}')`),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query(`select public.create_document('Bad','{"type":"script"}')`),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query(`select public.create_document('Missing root','{}')`),
    ).rejects.toMatchObject({ code: '23514' });
    expect(
      await scalar(
        `select public.create_document('New draft','{"type":"doc"}') is not null as value`,
      ),
    ).toBe(true);
  });
  it('restricts CRDT storage to the server, saves snapshots atomically, and blocks legacy overwrites', async () => {
    const collabDoc = '10000000-0000-0000-0000-000000000099';
    await identity(owner);
    await db.exec('reset role');
    await db.exec(
      `insert into public.documents(id,owner_id,title) values ('${collabDoc}','${owner}','Collaboration')`,
    );
    for (const user of [owner, editor, viewer, stranger]) {
      await identity(user);
      await expect(
        db.query(`select * from public.document_collaboration`),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        db.query(
          `select public.initialize_collaboration('${collabDoc}',0,'initial')`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        db.query(
          `select public.store_collaboration('${collabDoc}',1,'attack','Attack','{"type":"doc"}')`,
        ),
      ).rejects.toMatchObject({ code: '42501' });
    }
    await db.exec('reset role;set role service_role');
    await db.exec(
      `select public.initialize_collaboration('${collabDoc}',0,'initial')`,
    );
    expect(
      await scalar(
        `select state as value from public.initialize_collaboration('${collabDoc}',0,'duplicate')`,
      ),
    ).toBe('initial');
    expect(
      await scalar(
        `select public.store_collaboration('${collabDoc}',1,'merged','Shared title','{"type":"doc","content":[]}') as value`,
      ),
    ).toBe(2);
    await expect(
      db.query(
        `select public.store_collaboration('${collabDoc}',1,'stale','Stale','{"type":"doc"}')`,
      ),
    ).rejects.toMatchObject({ code: '55000' });
    await expect(
      db.query(
        `select public.store_collaboration('${collabDoc}',2,'bad','Invalid','{"type":"script"}')`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
    expect(
      await scalar(
        `select version as value from public.document_collaboration where document_id='${collabDoc}'`,
      ),
    ).toBe(2);
    await identity(owner);
    expect(
      await scalar(
        `select title as value from public.documents where id='${collabDoc}'`,
      ),
    ).toBe('Shared title');
    await expect(
      db.query(
        `select public.save_document('${collabDoc}',1,'Legacy client','{"type":"doc"}')`,
      ),
    ).rejects.toMatchObject({ code: '55000' });
  });
});

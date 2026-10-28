export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Permission = 'owner' | 'editor' | 'viewer';
export type DocumentSummary = {
  id: string;
  owner_id: string;
  title: string;
  revision: number;
  created_at: string;
  updated_at: string;
  owner_name: string;
  permission: Permission;
};
export type DocumentRow = {
  id: string;
  owner_id: string;
  title: string;
  content: Json;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type Share = {
  user_id: string;
  display_name: string;
  email: string;
  permission: string;
};
type Fn<Args, Returns> = { Args: Args; Returns: Returns };
export type Database = {
  public: {
    Tables: {
      document_collaboration: {
        Row: { document_id: string; state: string; version: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      initialize_collaboration: Fn<
        { doc_id: string; expected_revision: number; initial_state: string },
        { document_id: string; state: string; version: number }[]
      >;
      store_collaboration: Fn<
        {
          doc_id: string;
          expected_version: number;
          next_state: string;
          doc_title: string;
          doc_content: Json;
        },
        number
      >;
      list_documents: Fn<Record<string, never>, DocumentSummary[]>;
      create_document: Fn<{ doc_title: string; doc_content: Json }, string>;
      save_document: Fn<
        {
          doc_id: string;
          expected_revision: number;
          doc_title: string;
          doc_content: Json;
        },
        number
      >;
      document_access: Fn<{ doc_id: string }, Permission | null>;
      share_document: Fn<
        {
          doc_id: string;
          recipient_email: string;
          access_level: 'editor' | 'viewer';
        },
        undefined
      >;
      revoke_document_access: Fn<
        { doc_id: string; recipient_id: string },
        undefined
      >;
      request_document_access: Fn<{ doc_id: string }, undefined>;
      list_document_access_requests: Fn<
        { doc_id: string },
        Pick<Share, 'user_id' | 'display_name' | 'email'>[]
      >;
      resolve_document_access_request: Fn<
        {
          doc_id: string;
          recipient_id: string;
          access_level: 'editor' | 'viewer' | null;
        },
        undefined
      >;
      list_document_shares: Fn<{ doc_id: string }, Share[]>;
    };
    Enums: { document_permission: 'editor' | 'viewer' };
    CompositeTypes: Record<string, never>;
  };
};

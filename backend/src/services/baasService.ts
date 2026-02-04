/**
 * Supabase/Firebase Integration Service
 * Backend-as-a-Service integration for database, auth, storage, and functions
 */

import logger from "../middleware/logger.js";

// ========== Types ==========

export type BaaSProvider = "supabase" | "firebase";

// ========== Supabase Types ==========

export interface SupabaseConfig {
  projectUrl: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface SupabaseProject {
  id: string;
  name: string;
  organizationId: string;
  region: string;
  createdAt: string;
  status: "active" | "paused" | "inactive";
  databaseUrl?: string;
}

export interface SupabaseTable {
  name: string;
  schema: string;
  columns: SupabaseColumn[];
  primaryKey?: string[];
  foreignKeys?: SupabaseForeignKey[];
  rowCount?: number;
}

export interface SupabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
}

export interface SupabaseForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete?: "cascade" | "set null" | "restrict" | "no action";
  onUpdate?: "cascade" | "set null" | "restrict" | "no action";
}

export interface SupabaseFunction {
  id: string;
  name: string;
  slug: string;
  status: "active" | "throttled" | "removed";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupabaseBucket {
  id: string;
  name: string;
  public: boolean;
  createdAt: string;
  fileSizeLimit?: number;
  allowedMimeTypes?: string[];
}

// ========== Firebase Types ==========

export interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface FirebaseProject {
  projectId: string;
  displayName: string;
  projectNumber: string;
  state: "ACTIVE" | "DELETED";
  resources: {
    hostingSite?: string;
    storageBucket?: string;
    locationId?: string;
  };
}

export interface FirestoreCollection {
  name: string;
  documentCount?: number;
  fields?: FirestoreField[];
}

export interface FirestoreField {
  name: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "timestamp"
    | "geopoint"
    | "reference"
    | "array"
    | "map"
    | "null";
}

export interface FirebaseFunction {
  name: string;
  status: "ACTIVE" | "OFFLINE" | "DEPLOY_IN_PROGRESS";
  runtime: string;
  entryPoint: string;
  httpsTrigger?: { url: string };
  eventTrigger?: { eventType: string; resource: string };
  labels?: Record<string, string>;
}

export interface StorageFile {
  name: string;
  bucket: string;
  size: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
  publicUrl?: string;
}

// ========== Schema Generation Types ==========

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyDefinition[];
  indexes?: IndexDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type:
    | "text"
    | "int"
    | "bigint"
    | "boolean"
    | "timestamp"
    | "uuid"
    | "json"
    | "jsonb"
    | "float"
    | "decimal";
  nullable?: boolean;
  defaultValue?: string;
  unique?: boolean;
}

export interface ForeignKeyDefinition {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete?: "cascade" | "set null" | "restrict";
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

// ========== Supabase Client ==========

class SupabaseClient {
  private projectUrl: string;
  private anonKey: string;
  private serviceRoleKey?: string;

  constructor(config: SupabaseConfig) {
    this.projectUrl = config.projectUrl;
    this.anonKey = config.anonKey;
    this.serviceRoleKey = config.serviceRoleKey;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    useServiceRole = false,
  ): Promise<T | null> {
    const url = `${this.projectUrl}${endpoint}`;
    const apiKey =
      useServiceRole && this.serviceRoleKey
        ? this.serviceRoleKey
        : this.anonKey;

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error(
          { status: res.status, error: errorText, endpoint },
          "Supabase API error",
        );
        return null;
      }

      if (res.status === 204) {
        return {} as T;
      }

      return (await res.json()) as T;
    } catch (err) {
      logger.error(
        { error: (err as Error).message, endpoint },
        "Supabase fetch error",
      );
      return null;
    }
  }

  // Database operations
  async select<T>(
    table: string,
    options: {
      columns?: string;
      filter?: Record<string, unknown>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<T[] | null> {
    const params = new URLSearchParams();
    if (options.columns) {
      params.set("select", options.columns);
    }
    if (options.order) {
      params.set(
        "order",
        `${options.order.column}.${options.order.ascending ? "asc" : "desc"}`,
      );
    }
    if (options.limit) {
      params.set("limit", String(options.limit));
    }
    if (options.offset) {
      params.set("offset", String(options.offset));
    }

    // Add filters
    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        params.set(key, `eq.${value}`);
      }
    }

    return this.fetch<T[]>(`/rest/v1/${table}?${params.toString()}`);
  }

  async insert<T>(
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[],
    options: {
      returning?: boolean;
      onConflict?: string;
    } = {},
  ): Promise<T[] | null> {
    const params = new URLSearchParams();
    if (options.onConflict) {
      params.set("on_conflict", options.onConflict);
    }

    const headers: Record<string, string> = {};
    if (options.returning !== false) {
      headers["Prefer"] = "return=representation";
    }

    return this.fetch<T[]>(
      `/rest/v1/${table}?${params.toString()}`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers,
      },
      true,
    );
  }

  async update<T>(
    table: string,
    data: Record<string, unknown>,
    filter: Record<string, unknown>,
  ): Promise<T[] | null> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      params.set(key, `eq.${value}`);
    }

    return this.fetch<T[]>(
      `/rest/v1/${table}?${params.toString()}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { Prefer: "return=representation" },
      },
      true,
    );
  }

  async delete(
    table: string,
    filter: Record<string, unknown>,
  ): Promise<boolean> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      params.set(key, `eq.${value}`);
    }

    const result = await this.fetch<unknown>(
      `/rest/v1/${table}?${params.toString()}`,
      {
        method: "DELETE",
      },
      true,
    );

    return result !== null;
  }

  // RPC (stored procedures)
  async rpc<T>(
    functionName: string,
    params: Record<string, unknown> = {},
  ): Promise<T | null> {
    return this.fetch<T>(`/rest/v1/rpc/${functionName}`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Storage operations
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer | globalThis.Blob,
    contentType: string,
  ): Promise<{ path: string } | null> {
    const url = `${this.projectUrl}/storage/v1/object/${bucket}/${path}`;
    const apiKey = this.serviceRoleKey ?? this.anonKey;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": contentType,
        },
        body: file as BodyInit,
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error(
          { status: res.status, error: errorText },
          "Supabase storage upload error",
        );
        return null;
      }

      return (await res.json()) as { path: string };
    } catch (err) {
      logger.error({ error: (err as Error).message }, "Supabase storage error");
      return null;
    }
  }

  async deleteFile(bucket: string, paths: string[]): Promise<boolean> {
    return (
      (await this.fetch(
        `/storage/v1/object/${bucket}`,
        {
          method: "DELETE",
          body: JSON.stringify({ prefixes: paths }),
        },
        true,
      )) !== null
    );
  }

  async listFiles(bucket: string, prefix?: string): Promise<StorageFile[]> {
    const body: Record<string, unknown> = { limit: 100 };
    if (prefix) {
      body.prefix = prefix;
    }

    const result = await this.fetch<
      Array<{
        name: string;
        id: string;
        metadata: { size: number; mimetype: string };
        created_at: string;
        updated_at: string;
      }>
    >(
      `/storage/v1/object/list/${bucket}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      true,
    );

    if (!result) return [];

    return result.map((f) => ({
      name: f.name,
      bucket,
      size: f.metadata?.size ?? 0,
      contentType: f.metadata?.mimetype ?? "application/octet-stream",
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));
  }

  getPublicUrl(bucket: string, path: string): string {
    return `${this.projectUrl}/storage/v1/object/public/${bucket}/${path}`;
  }

  // Auth operations (admin)
  async createUser(
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ id: string; email: string } | null> {
    return this.fetch(
      "/auth/v1/admin/users",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: metadata,
        }),
      },
      true,
    );
  }

  async deleteUser(userId: string): Promise<boolean> {
    return (
      (await this.fetch(
        `/auth/v1/admin/users/${userId}`,
        {
          method: "DELETE",
        },
        true,
      )) !== null
    );
  }

  async listUsers(
    page = 1,
    perPage = 50,
  ): Promise<Array<{ id: string; email: string; created_at: string }>> {
    const result = await this.fetch<{
      users: Array<{ id: string; email: string; created_at: string }>;
    }>(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {}, true);

    return result?.users ?? [];
  }
}

// ========== Firebase Client ==========

class FirebaseAdminClient {
  private projectId: string;
  private accessToken: string;

  constructor(projectId: string, accessToken: string) {
    this.projectId = projectId;
    this.accessToken = accessToken;
  }

  private async fetch<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<T | null> {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error(
          { status: res.status, error: errorText, url },
          "Firebase API error",
        );
        return null;
      }

      if (res.status === 204) {
        return {} as T;
      }

      return (await res.json()) as T;
    } catch (err) {
      logger.error(
        { error: (err as Error).message, url },
        "Firebase fetch error",
      );
      return null;
    }
  }

  // Firestore operations
  async getDocument<T>(
    collection: string,
    documentId: string,
  ): Promise<T | null> {
    const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${collection}/${documentId}`;

    interface FirestoreDoc {
      fields: Record<
        string,
        {
          stringValue?: string;
          integerValue?: string;
          booleanValue?: boolean;
          mapValue?: { fields: Record<string, unknown> };
        }
      >;
    }

    const result = await this.fetch<FirestoreDoc>(url);
    if (!result) return null;

    // Convert Firestore format to plain object
    return this.convertFirestoreDoc(result.fields) as T;
  }

  async queryCollection<T>(
    collection: string,
    options: {
      where?: Array<{
        field: string;
        op: "==" | "<" | ">" | "<=" | ">=" | "!=" | "in" | "array-contains";
        value: unknown;
      }>;
      orderBy?: { field: string; direction?: "asc" | "desc" };
      limit?: number;
    } = {},
  ): Promise<T[]> {
    const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents:runQuery`;

    interface StructuredQuery {
      from: Array<{ collectionId: string }>;
      where?: {
        compositeFilter?: {
          op: "AND";
          filters: Array<{
            fieldFilter: {
              field: { fieldPath: string };
              op: string;
              value: {
                stringValue?: string;
                integerValue?: number;
                booleanValue?: boolean;
              };
            };
          }>;
        };
      };
      orderBy?: Array<{
        field: { fieldPath: string };
        direction: "ASCENDING" | "DESCENDING";
      }>;
      limit?: number;
    }

    const structuredQuery: StructuredQuery = {
      from: [{ collectionId: collection }],
    };

    if (options.where && options.where.length > 0) {
      structuredQuery.where = {
        compositeFilter: {
          op: "AND",
          filters: options.where.map((w) => ({
            fieldFilter: {
              field: { fieldPath: w.field },
              op: this.mapOperator(w.op),
              value: this.toFirestoreValue(w.value),
            },
          })),
        },
      };
    }

    if (options.orderBy) {
      structuredQuery.orderBy = [
        {
          field: { fieldPath: options.orderBy.field },
          direction:
            options.orderBy.direction === "desc" ? "DESCENDING" : "ASCENDING",
        },
      ];
    }

    if (options.limit) {
      structuredQuery.limit = options.limit;
    }

    interface QueryResult {
      document?: {
        name: string;
        fields: Record<
          string,
          {
            stringValue?: string;
            integerValue?: string;
            booleanValue?: boolean;
            mapValue?: { fields: Record<string, unknown> };
          }
        >;
      };
    }

    const results = await this.fetch<QueryResult[]>(url, {
      method: "POST",
      body: JSON.stringify({ structuredQuery }),
    });

    if (!results) return [];

    return results
      .filter(
        (
          r,
        ): r is QueryResult & {
          document: NonNullable<QueryResult["document"]>;
        } => r.document !== undefined,
      )
      .map((r) => this.convertFirestoreDoc(r.document.fields) as T);
  }

  async createDocument<T>(
    collection: string,
    data: Record<string, unknown>,
    documentId?: string,
  ): Promise<T | null> {
    const url = documentId
      ? `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${collection}?documentId=${documentId}`
      : `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${collection}`;

    const fields = this.toFirestoreFields(data);

    const result = await this.fetch<{
      name: string;
      fields: Record<string, unknown>;
    }>(url, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });

    if (!result) return null;

    return this.convertFirestoreDoc(
      result.fields as Record<
        string,
        {
          stringValue?: string;
          integerValue?: string;
          booleanValue?: boolean;
          mapValue?: { fields: Record<string, unknown> };
        }
      >,
    ) as T;
  }

  async updateDocument<T>(
    collection: string,
    documentId: string,
    data: Record<string, unknown>,
  ): Promise<T | null> {
    const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${collection}/${documentId}`;

    const fields = this.toFirestoreFields(data);
    const updateMask = Object.keys(data)
      .map((f) => `updateMask.fieldPaths=${f}`)
      .join("&");

    const result = await this.fetch<{
      name: string;
      fields: Record<string, unknown>;
    }>(`${url}?${updateMask}`, {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    });

    if (!result) return null;

    return this.convertFirestoreDoc(
      result.fields as Record<
        string,
        {
          stringValue?: string;
          integerValue?: string;
          booleanValue?: boolean;
          mapValue?: { fields: Record<string, unknown> };
        }
      >,
    ) as T;
  }

  async deleteDocument(
    collection: string,
    documentId: string,
  ): Promise<boolean> {
    const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${collection}/${documentId}`;
    return (await this.fetch(url, { method: "DELETE" })) !== null;
  }

  // Helper methods
  private mapOperator(op: string): string {
    const opMap: Record<string, string> = {
      "==": "EQUAL",
      "<": "LESS_THAN",
      ">": "GREATER_THAN",
      "<=": "LESS_THAN_OR_EQUAL",
      ">=": "GREATER_THAN_OR_EQUAL",
      "!=": "NOT_EQUAL",
      in: "IN",
      "array-contains": "ARRAY_CONTAINS",
    };
    return opMap[op] ?? "EQUAL";
  }

  private toFirestoreValue(value: unknown): {
    stringValue?: string;
    integerValue?: number;
    booleanValue?: boolean;
    doubleValue?: number;
  } {
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "number") {
      return Number.isInteger(value)
        ? { integerValue: value }
        : { doubleValue: value };
    }
    if (typeof value === "boolean") return { booleanValue: value };
    return { stringValue: String(value) };
  }

  private toFirestoreFields(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = this.toFirestoreValue(value);
    }
    return fields;
  }

  private convertFirestoreDoc(
    fields: Record<
      string,
      {
        stringValue?: string;
        integerValue?: string;
        booleanValue?: boolean;
        mapValue?: { fields: Record<string, unknown> };
      }
    >,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if ("stringValue" in value) result[key] = value.stringValue;
      else if ("integerValue" in value && value.integerValue !== undefined)
        result[key] = parseInt(value.integerValue, 10);
      else if ("booleanValue" in value) result[key] = value.booleanValue;
      else if ("mapValue" in value && value.mapValue?.fields) {
        result[key] = this.convertFirestoreDoc(
          value.mapValue.fields as Record<
            string,
            {
              stringValue?: string;
              integerValue?: string;
              booleanValue?: boolean;
              mapValue?: { fields: Record<string, unknown> };
            }
          >,
        );
      }
    }
    return result;
  }

  // Storage operations
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string,
  ): Promise<{ name: string; mediaLink: string } | null> {
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": contentType,
        },
        body: file as BodyInit,
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error(
          { status: res.status, error: errorText },
          "Firebase storage upload error",
        );
        return null;
      }

      return (await res.json()) as { name: string; mediaLink: string };
    } catch (err) {
      logger.error({ error: (err as Error).message }, "Firebase storage error");
      return null;
    }
  }

  async deleteFile(bucket: string, path: string): Promise<boolean> {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`;
    return (await this.fetch(url, { method: "DELETE" })) !== null;
  }

  async listFiles(bucket: string, prefix?: string): Promise<StorageFile[]> {
    const params = new URLSearchParams();
    if (prefix) {
      params.set("prefix", prefix);
    }

    const result = await this.fetch<{
      items?: Array<{
        name: string;
        bucket: string;
        size: string;
        contentType: string;
        timeCreated: string;
        updated: string;
      }>;
    }>(
      `https://storage.googleapis.com/storage/v1/b/${bucket}/o?${params.toString()}`,
    );

    if (!result?.items) return [];

    return result.items.map((f) => ({
      name: f.name,
      bucket: f.bucket,
      size: parseInt(f.size, 10),
      contentType: f.contentType,
      createdAt: f.timeCreated,
      updatedAt: f.updated,
      publicUrl: `https://storage.googleapis.com/${bucket}/${f.name}`,
    }));
  }
}

// ========== Exported Functions ==========

// Supabase factory
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return new SupabaseClient(config);
}

// Firebase factory
export function createFirebaseClient(
  projectId: string,
  accessToken: string,
): FirebaseAdminClient {
  return new FirebaseAdminClient(projectId, accessToken);
}

// ========== Schema Generation ==========

/**
 * Generate SQL schema for Supabase from table definitions
 */
export function generateSupabaseSchema(tables: TableDefinition[]): string {
  const lines: string[] = [
    "-- Generated by G-Rump for Supabase",
    "-- Run this in the Supabase SQL Editor",
    "",
  ];

  for (const table of tables) {
    lines.push(`-- Table: ${table.name}`);
    lines.push(`CREATE TABLE IF NOT EXISTS ${table.name} (`);

    const columnDefs: string[] = [];
    for (const col of table.columns) {
      let def = `  ${col.name} ${mapSqlType(col.type)}`;
      if (!col.nullable) def += " NOT NULL";
      if (col.unique) def += " UNIQUE";
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      columnDefs.push(def);
    }

    // Primary key
    if (table.primaryKey && table.primaryKey.length > 0) {
      columnDefs.push(`  PRIMARY KEY (${table.primaryKey.join(", ")})`);
    }

    // Foreign keys
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        let fkDef = `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencesTable}(${fk.referencesColumn})`;
        if (fk.onDelete) fkDef += ` ON DELETE ${fk.onDelete.toUpperCase()}`;
        columnDefs.push(fkDef);
      }
    }

    lines.push(columnDefs.join(",\n"));
    lines.push(");");
    lines.push("");

    // Indexes
    if (table.indexes) {
      for (const idx of table.indexes) {
        const unique = idx.unique ? "UNIQUE " : "";
        lines.push(
          `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${table.name} (${idx.columns.join(", ")});`,
        );
      }
      lines.push("");
    }

    // Enable RLS
    lines.push(`ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate Firestore security rules
 */
export function generateFirestoreRules(
  collections: Array<{
    name: string;
    rules: {
      read?: "auth" | "owner" | "public" | "admin";
      write?: "auth" | "owner" | "admin";
      create?: "auth" | "owner" | "admin";
      update?: "auth" | "owner" | "admin";
      delete?: "auth" | "owner" | "admin";
    };
  }>,
): string {
  const lines: string[] = [
    "// Generated by G-Rump for Firebase",
    "rules_version = '2';",
    "service cloud.firestore {",
    "  match /databases/{database}/documents {",
    "",
  ];

  for (const collection of collections) {
    lines.push(`    // Collection: ${collection.name}`);
    lines.push(`    match /${collection.name}/{documentId} {`);

    const rules = collection.rules;

    // Read rule
    if (rules.read) {
      lines.push(`      allow read: if ${mapFirestoreRule(rules.read)};`);
    }

    // Write rules (or individual)
    if (rules.write) {
      lines.push(`      allow write: if ${mapFirestoreRule(rules.write)};`);
    } else {
      if (rules.create) {
        lines.push(`      allow create: if ${mapFirestoreRule(rules.create)};`);
      }
      if (rules.update) {
        lines.push(`      allow update: if ${mapFirestoreRule(rules.update)};`);
      }
      if (rules.delete) {
        lines.push(`      allow delete: if ${mapFirestoreRule(rules.delete)};`);
      }
    }

    lines.push("    }");
    lines.push("");
  }

  lines.push("  }");
  lines.push("}");

  return lines.join("\n");
}

function mapSqlType(type: ColumnDefinition["type"]): string {
  const typeMap: Record<string, string> = {
    text: "TEXT",
    int: "INTEGER",
    bigint: "BIGINT",
    boolean: "BOOLEAN",
    timestamp: "TIMESTAMPTZ DEFAULT NOW()",
    uuid: "UUID DEFAULT gen_random_uuid()",
    json: "JSON",
    jsonb: "JSONB",
    float: "REAL",
    decimal: "DECIMAL(10, 2)",
  };
  return typeMap[type] ?? "TEXT";
}

function mapFirestoreRule(rule: string): string {
  switch (rule) {
    case "public":
      return "true";
    case "auth":
      return "request.auth != null";
    case "owner":
      return "request.auth != null && request.auth.uid == resource.data.userId";
    case "admin":
      return "request.auth != null && request.auth.token.admin == true";
    default:
      return "false";
  }
}

/**
 * Generate RLS policies for Supabase
 */
export function generateRLSPolicies(
  table: string,
  policies: Array<{
    name: string;
    operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
    using?: string;
    withCheck?: string;
  }>,
): string {
  const lines: string[] = [
    `-- RLS Policies for ${table}`,
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    "",
  ];

  for (const policy of policies) {
    lines.push(`CREATE POLICY "${policy.name}" ON ${table}`);
    lines.push(`  FOR ${policy.operation}`);
    lines.push("  TO authenticated");

    if (policy.using) {
      lines.push(`  USING (${policy.using})`);
    }

    if (policy.withCheck) {
      lines.push(`  WITH CHECK (${policy.withCheck})`);
    }

    lines.push(";");
    lines.push("");
  }

  return lines.join("\n");
}

// ========== Quick Templates ==========

/**
 * Generate a user/profile schema
 */
export function generateUserSchema(): TableDefinition[] {
  return [
    {
      name: "profiles",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "email", type: "text", nullable: false, unique: true },
        { name: "display_name", type: "text", nullable: true },
        { name: "avatar_url", type: "text", nullable: true },
        { name: "bio", type: "text", nullable: true },
        { name: "created_at", type: "timestamp", nullable: false },
        { name: "updated_at", type: "timestamp", nullable: false },
      ],
      primaryKey: ["id"],
      indexes: [
        { name: "profiles_email_idx", columns: ["email"], unique: true },
      ],
    },
    {
      name: "user_settings",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "user_id", type: "uuid", nullable: false },
        {
          name: "theme",
          type: "text",
          nullable: true,
          defaultValue: "'light'",
        },
        {
          name: "notifications",
          type: "boolean",
          nullable: false,
          defaultValue: "true",
        },
        { name: "preferences", type: "jsonb", nullable: true },
        { name: "updated_at", type: "timestamp", nullable: false },
      ],
      primaryKey: ["id"],
      foreignKeys: [
        {
          column: "user_id",
          referencesTable: "profiles",
          referencesColumn: "id",
          onDelete: "cascade",
        },
      ],
    },
  ];
}

/**
 * Generate a blog schema
 */
export function generateBlogSchema(): TableDefinition[] {
  return [
    {
      name: "posts",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "author_id", type: "uuid", nullable: false },
        { name: "title", type: "text", nullable: false },
        { name: "slug", type: "text", nullable: false, unique: true },
        { name: "content", type: "text", nullable: true },
        { name: "excerpt", type: "text", nullable: true },
        {
          name: "published",
          type: "boolean",
          nullable: false,
          defaultValue: "false",
        },
        { name: "published_at", type: "timestamp", nullable: true },
        { name: "created_at", type: "timestamp", nullable: false },
        { name: "updated_at", type: "timestamp", nullable: false },
      ],
      primaryKey: ["id"],
      foreignKeys: [
        {
          column: "author_id",
          referencesTable: "profiles",
          referencesColumn: "id",
          onDelete: "cascade",
        },
      ],
      indexes: [
        { name: "posts_slug_idx", columns: ["slug"], unique: true },
        { name: "posts_author_idx", columns: ["author_id"] },
        { name: "posts_published_idx", columns: ["published", "published_at"] },
      ],
    },
    {
      name: "categories",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "name", type: "text", nullable: false },
        { name: "slug", type: "text", nullable: false, unique: true },
        { name: "description", type: "text", nullable: true },
      ],
      primaryKey: ["id"],
    },
    {
      name: "post_categories",
      columns: [
        { name: "post_id", type: "uuid", nullable: false },
        { name: "category_id", type: "uuid", nullable: false },
      ],
      primaryKey: ["post_id", "category_id"],
      foreignKeys: [
        {
          column: "post_id",
          referencesTable: "posts",
          referencesColumn: "id",
          onDelete: "cascade",
        },
        {
          column: "category_id",
          referencesTable: "categories",
          referencesColumn: "id",
          onDelete: "cascade",
        },
      ],
    },
    {
      name: "comments",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "post_id", type: "uuid", nullable: false },
        { name: "author_id", type: "uuid", nullable: false },
        { name: "parent_id", type: "uuid", nullable: true },
        { name: "content", type: "text", nullable: false },
        { name: "created_at", type: "timestamp", nullable: false },
        { name: "updated_at", type: "timestamp", nullable: false },
      ],
      primaryKey: ["id"],
      foreignKeys: [
        {
          column: "post_id",
          referencesTable: "posts",
          referencesColumn: "id",
          onDelete: "cascade",
        },
        {
          column: "author_id",
          referencesTable: "profiles",
          referencesColumn: "id",
          onDelete: "cascade",
        },
        {
          column: "parent_id",
          referencesTable: "comments",
          referencesColumn: "id",
          onDelete: "cascade",
        },
      ],
    },
  ];
}

/**
 * Generate an e-commerce schema
 */
export function generateEcommerceSchema(): TableDefinition[] {
  return [
    {
      name: "products",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "name", type: "text", nullable: false },
        { name: "slug", type: "text", nullable: false, unique: true },
        { name: "description", type: "text", nullable: true },
        { name: "price", type: "decimal", nullable: false },
        { name: "compare_at_price", type: "decimal", nullable: true },
        {
          name: "inventory_count",
          type: "int",
          nullable: false,
          defaultValue: "0",
        },
        { name: "images", type: "jsonb", nullable: true },
        { name: "metadata", type: "jsonb", nullable: true },
        {
          name: "active",
          type: "boolean",
          nullable: false,
          defaultValue: "true",
        },
        { name: "created_at", type: "timestamp", nullable: false },
        { name: "updated_at", type: "timestamp", nullable: false },
      ],
      primaryKey: ["id"],
      indexes: [
        { name: "products_slug_idx", columns: ["slug"], unique: true },
        { name: "products_active_idx", columns: ["active"] },
      ],
    },
    {
      name: "orders",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "user_id", type: "uuid", nullable: false },
        {
          name: "status",
          type: "text",
          nullable: false,
          defaultValue: "'pending'",
        },
        { name: "subtotal", type: "decimal", nullable: false },
        { name: "tax", type: "decimal", nullable: false, defaultValue: "0" },
        {
          name: "shipping",
          type: "decimal",
          nullable: false,
          defaultValue: "0",
        },
        { name: "total", type: "decimal", nullable: false },
        { name: "shipping_address", type: "jsonb", nullable: true },
        { name: "billing_address", type: "jsonb", nullable: true },
        { name: "payment_intent_id", type: "text", nullable: true },
        { name: "created_at", type: "timestamp", nullable: false },
        { name: "updated_at", type: "timestamp", nullable: false },
      ],
      primaryKey: ["id"],
      foreignKeys: [
        {
          column: "user_id",
          referencesTable: "profiles",
          referencesColumn: "id",
        },
      ],
      indexes: [
        { name: "orders_user_idx", columns: ["user_id"] },
        { name: "orders_status_idx", columns: ["status"] },
      ],
    },
    {
      name: "order_items",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "order_id", type: "uuid", nullable: false },
        { name: "product_id", type: "uuid", nullable: false },
        { name: "quantity", type: "int", nullable: false },
        { name: "unit_price", type: "decimal", nullable: false },
        { name: "total_price", type: "decimal", nullable: false },
      ],
      primaryKey: ["id"],
      foreignKeys: [
        {
          column: "order_id",
          referencesTable: "orders",
          referencesColumn: "id",
          onDelete: "cascade",
        },
        {
          column: "product_id",
          referencesTable: "products",
          referencesColumn: "id",
        },
      ],
    },
  ];
}

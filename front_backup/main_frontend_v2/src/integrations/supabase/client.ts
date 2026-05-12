/**
 * Minimal supabase-js compatible wrapper.
 *
 * The lovable frontend was generated for Supabase; this project now uses:
 * Better Auth + Prisma + PostgreSQL.
 *
 * We keep the same `supabase.from(table).select(...).eq(...).order(...)` shape
 * so the existing Planning UI works, but the actual data is served by
 * our backend at `/api/planning/*`.
 */

type FilterOp = "eq" | "gte" | "lte";
type Filter = { column: string; op: FilterOp; value: unknown };

type SupabaseError = { message: string } | null;
type SupabaseResult<T> = { data: T | null; error: SupabaseError };

const JWT_STORAGE_KEY = "myrtest_jwt_token";

function getJwtToken(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEY);
}

async function jsonOrThrow(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class FromQueryBuilder {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectColumns: string | null = null;
  private orderBy: string | null = null;
  private filters: Filter[] = [];
  private singleRow: boolean = false;
  private updateValues: Record<string, unknown> | null = null;
  private insertValues: Record<string, unknown>[] = [];
  private upsertValues: Record<string, unknown>[] = [];
  private upsertOnConflict: string | null = null;

  constructor(private table: string) {}

  select(columns: string) {
    this.selectColumns = columns;
    return this;
  }

  order(column: string) {
    this.orderBy = column;
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, op: "gte", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, op: "lte", value });
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  update(values: Record<string, unknown>) {
    this.operation = "update";
    this.updateValues = values;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.operation = "insert";
    this.insertValues = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) {
    this.operation = "upsert";
    this.upsertValues = Array.isArray(values) ? values : [values];
    this.upsertOnConflict = opts?.onConflict ?? null;
    return this;
  }

  // Make this query builder awaitable (so `await supabase.from(...).select(...)` works)
  then<TResult1 = any, TResult2 = never>(
    resolve: (value: SupabaseResult<TResult1>) => TResult1 | PromiseLike<TResult1>,
    reject?: (reason: any) => TResult2 | PromiseLike<TResult2>
  ): Promise<TResult1 | TResult2> {
    const p = this.execute();
    if (reject) return p.then(resolve as any).catch(reject as any);
    return p.then(resolve as any);
  }

  private async execute(): Promise<SupabaseResult<any>> {
    const token = getJwtToken();
    if (!token) return { data: null, error: { message: "Missing JWT token" } };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const filterEq = (col: string) => this.filters.find((f) => f.column === col && f.op === "eq")?.value;
    const filterRange = (col: string) => {
      const gte = this.filters.find((f) => f.column === col && f.op === "gte")?.value;
      const lte = this.filters.find((f) => f.column === col && f.op === "lte")?.value;
      return { gte, lte };
    };

    const getDayRange = () => {
      const { gte, lte } = filterRange("day_date");
      return { from: gte, to: lte };
    };

    const base = `/api/planning/${this.table}`;

    try {
      // SELECT
      if (this.operation === "select") {
        if (this.table === "luxlait_daily_assignments" || this.table === "luxlait_weekly_employee_statuses") {
          const { from, to } = getDayRange();
          const url = new URL(base, window.location.origin);
          url.searchParams.set("fromDate", String(from));
          url.searchParams.set("toDate", String(to));
          const res = await fetch(url.toString(), { headers });
          const json = await jsonOrThrow(res);
          if (!res.ok) return { data: null, error: { message: (json as any)?.error ?? "Select failed" } };
          const data = (Array.isArray(json) ? (this.singleRow ? json[0] : json) : this.singleRow ? json : json);
          return { data: data as any, error: null };
        }

        const url = new URL(base, window.location.origin);
        // employees(active=...)
        const active = filterEq("active");
        if (this.table === "luxlait_employees" && active !== undefined) {
          url.searchParams.set("active", String(active));
        }
        if (this.orderBy) {
          url.searchParams.set("orderBy", this.orderBy);
        }

        const res = await fetch(url.toString(), { headers });
        const json = await jsonOrThrow(res);
        if (!res.ok) return { data: null, error: { message: (json as any)?.error ?? "Select failed" } };
        const data = (Array.isArray(json) ? (this.singleRow ? json[0] : json) : this.singleRow ? json : json);
        return { data: data as any, error: null };
      }

      // INSERT
      if (this.operation === "insert") {
        const row = this.insertValues[0] ?? {};
        const endpoint = this.table === "luxlait_daily_assignments"
          ? `/api/planning/${this.table}`
          : this.table === "luxlait_weekly_employee_statuses"
            ? `/api/planning/${this.table}`
            : `/api/planning/${this.table}`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        const json = await jsonOrThrow(res);
        if (!res.ok) return { data: null, error: { message: (json as any)?.error ?? "Insert failed" } };
        const data = (json as any)?.data ?? json;
        return { data: this.singleRow && Array.isArray(data) ? data[0] : data, error: null };
      }

      // UPSERT (only used by daily_assignments in the Planning UI)
      if (this.operation === "upsert") {
        const endpoint = `/api/planning/${this.table}/upsert`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ rows: this.upsertValues }),
        });
        const json = await jsonOrThrow(res);
        if (!res.ok) return { data: null, error: { message: (json as any)?.error ?? "Upsert failed" } };
        return { data: null, error: null };
      }

      // UPDATE (Planning UI updates by id only)
      if (this.operation === "update") {
        const id = filterEq("id");
        const endpoint = `/api/planning/${this.table}/${String(id)}`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(this.updateValues ?? {}),
        });
        const json = await jsonOrThrow(res);
        if (!res.ok) return { data: null, error: { message: (json as any)?.error ?? "Update failed" } };
        return { data: (json as any)?.data ?? null, error: null };
      }

      // DELETE (Planning UI deletes by id only)
      if (this.operation === "delete") {
        if (this.table === "luxlait_employee_machine_skills") {
          const employeeId = filterEq("employee_id");
          const machineId = filterEq("machine_id");
          const res = await fetch(`/api/planning/${this.table}`, {
            method: "DELETE",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              employee_id: employeeId,
              machine_id: machineId,
            }),
          });
          const json = await jsonOrThrow(res);
          if (!res.ok) return { data: null, error: { message: (json as any)?.error ?? "Delete failed" } };
          return { data: null, error: null };
        }
        const id = filterEq("id");
        const endpoint = `/api/planning/${this.table}/${String(id)}`;
        const res = await fetch(endpoint, { method: "DELETE", headers });
        const json = await jsonOrThrow(res);
        if (!res.ok) return { data: null, error: { message: (json as any)?.error ?? "Delete failed" } };
        return { data: null, error: null };
      }

      return { data: null, error: { message: "Unsupported operation" } };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : "Request failed" } };
    }
  }
}

export const supabase = {
  from(table: string) {
    return new FromQueryBuilder(table);
  },
};
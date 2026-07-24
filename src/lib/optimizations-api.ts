import { supabase } from "@/integrations/supabase/client";
import type {
  AffectedResource,
  Confidence,
  ConfidenceFactor,
  Optimization,
  OptStatus,
  SavingsLine,
  Service,
} from "@/lib/mock-data";

export type ActionType = "applied" | "dismissed" | "reverted";

export interface OptimizationAction {
  id: string;
  optimization_id: string;
  action: ActionType;
  actor: string;
  savings_usd: number;
  notes: string | null;
  created_at: string;
}

type Row = {
  id: string;
  type: string;
  resource_id: string;
  service: string;
  current_cost: number | string;
  projected_cost: number | string;
  savings_usd: number | string;
  confidence: string;
  status: string;
  description: string;
  affected_resources: unknown;
  confidence_summary: string;
  confidence_factors: unknown;
  savings_breakdown: unknown;
  implementation_notes: string;
  created_at?: string;
  applied_at?: string | null;
};

function num(v: number | string): number {
  return typeof v === "string" ? Number(v) : v;
}

export function toOptimization(r: Row): Optimization {
  return {
    id: r.id,
    type: r.type,
    resource_id: r.resource_id,
    service: r.service as Service,
    current_cost: num(r.current_cost),
    projected_cost: num(r.projected_cost),
    savings_usd: num(r.savings_usd),
    confidence: r.confidence as Confidence,
    status: r.status as OptStatus,
    description: r.description,
    affected_resources: (r.affected_resources as AffectedResource[]) ?? [],
    confidence_summary: r.confidence_summary,
    confidence_factors: (r.confidence_factors as ConfidenceFactor[]) ?? [],
    savings_breakdown: (r.savings_breakdown as SavingsLine[]) ?? [],
    implementation_notes: r.implementation_notes,
    created_at: r.created_at,
    applied_at: r.applied_at ?? null,
  };
}

export interface OptimizationExportRow extends Optimization {
  latest_action: ActionType | null;
  latest_action_at: string | null;
  latest_action_actor: string | null;
  latest_action_notes: string | null;
  realized_savings_usd: number;
}

/**
 * Fetches every optimization in the org together with its latest audit-log
 * entry so a CSV export can show the trail (status, applied_at, and the
 * savings impact recorded on the most recent action).
 */
export async function fetchExportRows(): Promise<OptimizationExportRow[]> {
  const { data: optRows, error: optErr } = await supabase
    .from("optimizations")
    .select("*")
    .order("savings_usd", { ascending: false });
  if (optErr) throw optErr;

  const opts = (optRows as Row[]).map(toOptimization);
  const ids = opts.map((o) => o.id);
  if (ids.length === 0) return [];

  const { data: actionRows, error: actErr } = await supabase
    .from("optimization_actions")
    .select("optimization_id, action, actor, notes, savings_usd, created_at")
    .in("optimization_id", ids)
    .order("created_at", { ascending: false });
  if (actErr) throw actErr;

  const latest = new Map<
    string,
    {
      action: ActionType;
      actor: string;
      notes: string | null;
      savings_usd: number;
      created_at: string;
    }
  >();
  for (const a of (actionRows ?? []) as Array<{
    optimization_id: string;
    action: ActionType;
    actor: string;
    notes: string | null;
    savings_usd: number | string;
    created_at: string;
  }>) {
    if (!latest.has(a.optimization_id)) {
      latest.set(a.optimization_id, {
        action: a.action,
        actor: a.actor,
        notes: a.notes,
        savings_usd: num(a.savings_usd),
        created_at: a.created_at,
      });
    }
  }

  return opts.map((o) => {
    const l = latest.get(o.id);
    return {
      ...o,
      latest_action: l?.action ?? null,
      latest_action_at: l?.created_at ?? o.applied_at ?? null,
      latest_action_actor: l?.actor ?? null,
      latest_action_notes: l?.notes ?? null,
      realized_savings_usd:
        o.status === "applied" ? (l?.savings_usd ?? o.savings_usd) : 0,
    };
  });
}

async function currentContext(): Promise<{ userId: string; email: string; orgId: string }> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not signed in");
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("org_id, email")
    .eq("id", userData.user.id)
    .single();
  if (profErr) throw profErr;
  return {
    userId: userData.user.id,
    email: profile.email ?? userData.user.email ?? "unknown",
    orgId: profile.org_id,
  };
}

export async function listOptimizations(): Promise<Optimization[]> {
  const { data, error } = await supabase
    .from("optimizations")
    .select("*")
    .order("savings_usd", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toOptimization);
}

export type OptSortKey = "savings" | "confidence" | "date";

export interface OptQueryParams {
  search?: string;
  confidence?: "all" | Confidence;
  type?: string; // "all" or a specific type
  min?: number | null;
  max?: number | null;
  sort?: OptSortKey;
  dir?: "asc" | "desc";
  page?: number; // 1-based
  pageSize?: number;
}

export interface OptQueryResult {
  items: Optimization[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Server-side filter / search / sort / paginate for the optimizations table.
 * All work happens in Postgres via PostgREST; only the current page of rows
 * is transferred over the wire, plus an exact total for pagination UI.
 */
export async function queryOptimizations(
  params: OptQueryParams = {},
): Promise<OptQueryResult> {
  const {
    search = "",
    confidence = "all",
    type = "all",
    min = null,
    max = null,
    sort = "savings",
    dir = "desc",
    page = 1,
    pageSize = 8,
  } = params;

  let q = supabase
    .from("optimizations")
    .select("*", { count: "exact" });

  if (confidence !== "all") q = q.eq("confidence", confidence);
  if (type && type !== "all") q = q.eq("type", type);
  if (min != null && Number.isFinite(min)) q = q.gte("savings_usd", min);
  if (max != null && Number.isFinite(max)) q = q.lte("savings_usd", max);

  const term = search.trim();
  if (term) {
    // Escape PostgREST reserved chars in ilike patterns.
    const safe = term.replace(/[,()*]/g, " ").replace(/%/g, "\\%");
    const pat = `%${safe}%`;
    q = q.or(
      [
        `type.ilike.${pat}`,
        `resource_id.ilike.${pat}`,
        `description.ilike.${pat}`,
        `service.ilike.${pat}`,
      ].join(","),
    );
  }

  const ascending = dir === "asc";
  const sortColumn =
    sort === "date"
      ? "created_at"
      : sort === "confidence"
        ? "confidence_rank"
        : "savings_usd";
  q = q.order(sortColumn, { ascending });
  // Deterministic tie-break so paging is stable.
  q = q.order("id", { ascending: true });

  const safePage = Math.max(1, Math.floor(page));
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return {
    items: (data as Row[]).map(toOptimization),
    total: count ?? 0,
    page: safePage,
    pageSize,
  };
}

/**
 * Fetch every optimization matching the current filter/sort (no pagination),
 * so the CSV export mirrors what the user is viewing in the table.
 */
export async function exportFilteredOptimizations(
  params: Omit<OptQueryParams, "page" | "pageSize"> = {},
): Promise<Optimization[]> {
  const {
    search = "",
    confidence = "all",
    type = "all",
    min = null,
    max = null,
    sort = "savings",
    dir = "desc",
  } = params;

  let q = supabase.from("optimizations").select("*");
  if (confidence !== "all") q = q.eq("confidence", confidence);
  if (type && type !== "all") q = q.eq("type", type);
  if (min != null && Number.isFinite(min)) q = q.gte("savings_usd", min);
  if (max != null && Number.isFinite(max)) q = q.lte("savings_usd", max);

  const term = search.trim();
  if (term) {
    const safe = term.replace(/[,()*]/g, " ").replace(/%/g, "\\%");
    const pat = `%${safe}%`;
    q = q.or(
      [
        `type.ilike.${pat}`,
        `resource_id.ilike.${pat}`,
        `description.ilike.${pat}`,
        `service.ilike.${pat}`,
      ].join(","),
    );
  }

  const ascending = dir === "asc";
  const sortColumn =
    sort === "date"
      ? "created_at"
      : sort === "confidence"
        ? "confidence_rank"
        : "savings_usd";
  q = q.order(sortColumn, { ascending }).order("id", { ascending: true });

  const { data, error } = await q;
  if (error) throw error;
  return (data as Row[]).map(toOptimization);
}

/** Distinct optimization types in the current org (for the type filter). */
export async function listOptimizationTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from("optimizations")
    .select("type")
    .order("type", { ascending: true });
  if (error) throw error;
  const seen = new Set<string>();
  for (const row of (data ?? []) as { type: string }[]) seen.add(row.type);
  return Array.from(seen);
}

export async function listRecentActions(limit = 50): Promise<OptimizationAction[]> {
  const { data, error } = await supabase
    .from("optimization_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as OptimizationAction[]) ?? [];
}

export async function listActionsFor(
  optimizationId: string,
): Promise<OptimizationAction[]> {
  const { data, error } = await supabase
    .from("optimization_actions")
    .select("*")
    .eq("optimization_id", optimizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as OptimizationAction[]) ?? [];
}

/**
 * End-to-end apply flow:
 *  1. Update optimization row → status='applied', applied_at=now()
 *  2. Insert an audit-log row in optimization_actions
 * Both writes go through the signed-in RLS-scoped client. The action row is
 * stamped with the caller's org and user id so RLS accepts it.
 */
export async function applyOptimization(
  opt: Optimization,
  opts: { notes?: string } = {},
): Promise<{ optimization: Optimization; action: OptimizationAction }> {
  if (opt.status === "applied") {
    throw new Error("Optimization is already applied");
  }

  const ctx = await currentContext();

  const { data: updated, error: updateErr } = await supabase
    .from("optimizations")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", opt.id)
    .eq("status", "pending")
    .select("*")
    .single();

  if (updateErr) throw updateErr;
  if (!updated) throw new Error("Optimization not in pending state");

  const { data: action, error: actionErr } = await supabase
    .from("optimization_actions")
    .insert({
      optimization_id: opt.id,
      action: "applied",
      actor: ctx.email,
      user_id: ctx.userId,
      org_id: (updated as { org_id: string }).org_id ?? ctx.orgId,
      savings_usd: opt.savings_usd,
      notes: opts.notes ?? null,
      metadata: {
        service: opt.service,
        type: opt.type,
        resource_id: opt.resource_id,
      },
    })
    .select("*")
    .single();

  if (actionErr) throw actionErr;

  return {
    optimization: toOptimization(updated as Row),
    action: action as unknown as OptimizationAction,
  };
}

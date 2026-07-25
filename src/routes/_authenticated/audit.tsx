import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, Loader2, Search, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { Optimization } from "@/lib/mock-data";
import {
  listOptimizations,
  listRecentActions,
  type ActionType,
  type OptimizationAction,
} from "@/lib/optimizations-api";

export const Route = createFileRoute("/_authenticated/audit")({
  validateSearch: zodValidator(
    z.object({
      opt: fallback(z.string().optional(), undefined),
    }),
  ),
  search: { middlewares: [stripSearchParams({ opt: undefined })] },
  head: () => ({
    meta: [
      { title: "Audit log · Linsiq" },
      {
        name: "description",
        content:
          "Timeline of every applied, dismissed, and reverted optimization with actor, savings, and timestamp.",
      },
      { property: "og:title", content: "Audit log · Linsiq" },
      {
        property: "og:description",
        content: "Timeline of every optimization change with actor and timestamp.",
      },
    ],
  }),
  component: AuditPage,
});

const fmtCurrency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const actionStyle: Record<ActionType, string> = {
  applied: "border-savings/40 bg-savings-muted/40 text-savings",
  dismissed: "border-muted-foreground/30 bg-muted text-muted-foreground",
  reverted: "border-spend/40 bg-spend-muted/40 text-spend",
};

function fmtAbsolute(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRelative(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function AuditPage() {
  const { opt: optSearchParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [actions, setActions] = useState<OptimizationAction[]>([]);
  const [opts, setOpts] = useState<Optimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | ActionType>("all");
  const [optFilter, setOptFilter] = useState<string>(optSearchParam ?? "all");

  useEffect(() => {
    setOptFilter(optSearchParam ?? "all");
  }, [optSearchParam]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listRecentActions(500), listOptimizations()]);
        if (cancelled) return;
        setActions(a);
        setOpts(o);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load audit log");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const optIndex = useMemo(() => {
    const m = new Map<string, Optimization>();
    for (const o of opts) m.set(o.id, o);
    return m;
  }, [opts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return actions.filter((a) => {
      if (actionFilter !== "all" && a.action !== actionFilter) return false;
      if (optFilter !== "all" && a.optimization_id !== optFilter) return false;
      if (q) {
        const opt = optIndex.get(a.optimization_id);
        const hay =
          `${a.actor} ${a.action} ${a.optimization_id} ${a.notes ?? ""} ${opt?.type ?? ""} ${opt?.resource_id ?? ""} ${opt?.service ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [actions, actionFilter, optFilter, search, optIndex]);

  const grouped = useMemo(() => {
    const groups = new Map<string, OptimizationAction[]>();
    for (const a of filtered) {
      const key = dayKey(a.created_at);
      const arr = groups.get(key);
      if (arr) arr.push(a);
      else groups.set(key, [a]);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const totalSavings = filtered
    .filter((a) => a.action === "applied")
    .reduce((s, a) => s + Number(a.savings_usd), 0);

  const activeOptFilters = useMemo(
    () => Array.from(new Set(actions.map((a) => a.optimization_id))),
    [actions],
  );

  const hasFilters = search !== "" || actionFilter !== "all" || optFilter !== "all";

  return (
    <AppLayout>
      <PageHeader
        title="Audit log"
        description={
          loading
            ? "Loading history…"
            : `${filtered.length} event${filtered.length === 1 ? "" : "s"} · ${fmtCurrency(totalSavings)}/mo savings realized`
        }
        actions={
          <Link
            to="/optimizations"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Go to optimizations <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, resource, notes…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as typeof actionFilter)}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
              <SelectItem value="reverted">Reverted</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={optFilter}
            onValueChange={(v) => {
              setOptFilter(v);
              navigate({ search: { opt: v === "all" ? undefined : v }, replace: true });
            }}
          >
            <SelectTrigger className="h-9 w-[220px] text-xs">
              <SelectValue placeholder="Optimization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All optimizations</SelectItem>
              {activeOptFilters.map((id) => {
                const o = optIndex.get(id);
                return (
                  <SelectItem key={id} value={id}>
                    {o ? `${o.type} · ${o.resource_id}` : id}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setSearch("");
                setActionFilter("all");
                setOptFilter("all");
                navigate({ search: { opt: undefined }, replace: true });
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <History className="h-8 w-8 text-muted-foreground/60" />
            <div className="text-sm font-medium text-foreground">No events</div>
            <div className="max-w-sm text-xs text-muted-foreground">
              {actions.length === 0
                ? "Apply an optimization to record your first audit entry."
                : "No events match the current filters."}
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {grouped.map(([day, dayActions]) => (
              <div key={day}>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-muted/40 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <span>{day}</span>
                  <span>{dayActions.length} event{dayActions.length === 1 ? "" : "s"}</span>
                </div>
                <ul className="divide-y">
                  {dayActions.map((a) => {
                    const opt = optIndex.get(a.optimization_id);
                    return (
                      <li key={a.id} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/20">
                        <div className="mt-0.5 shrink-0">
                          <span
                            className={`inline-flex min-w-[74px] justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionStyle[a.action]}`}
                          >
                            {a.action}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {opt?.type ?? "Unknown optimization"}
                            </span>
                            {opt && (
                              <Badge variant="outline" className="text-[10px]">
                                {opt.service}
                              </Badge>
                            )}
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {opt?.resource_id ?? a.optimization_id}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{a.actor}</span>
                            {a.notes ? <> · {a.notes}</> : null}
                          </div>
                        </div>
                        <div className="ml-4 shrink-0 text-right">
                          {a.action === "applied" && Number(a.savings_usd) > 0 && (
                            <div className="text-sm font-semibold text-savings">
                              +{fmtCurrency(Number(a.savings_usd))}/mo
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground" title={fmtAbsolute(a.created_at)}>
                            {fmtRelative(a.created_at)}
                          </div>
                          <div className="text-[10px] text-muted-foreground/70">
                            {fmtAbsolute(a.created_at)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppLayout>
  );
}

import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CheckCircle2, Filter, ArrowRight, Sparkles, History, Loader2, Search, ChevronLeft, ChevronRight, X, ArrowUp, ArrowDown, ArrowUpDown, Download } from "lucide-react";
import type { Confidence, OptStatus, Optimization } from "@/lib/mock-data";
import {
  applyOptimization,
  exportFilteredOptimizations,
  listActionsFor,
  listOptimizationTypes,
  listRecentActions,
  queryOptimizations,
  type OptimizationAction,
} from "@/lib/optimizations-api";
import { toast } from "sonner";

const searchDefaults = {
  q: "",
  confidence: "all" as "all" | Confidence,
  type: "all",
  min: "",
  max: "",
  page: 1,
  sort: "savings" as "savings" | "confidence" | "date",
  dir: "desc" as "asc" | "desc",
};

const searchSchema = z.object({
  q: fallback(z.string(), searchDefaults.q).default(searchDefaults.q),
  confidence: fallback(z.string(), searchDefaults.confidence).default(searchDefaults.confidence),
  type: fallback(z.string(), searchDefaults.type).default(searchDefaults.type),
  min: fallback(z.string(), searchDefaults.min).default(searchDefaults.min),
  max: fallback(z.string(), searchDefaults.max).default(searchDefaults.max),
  page: fallback(z.number().int(), searchDefaults.page).default(searchDefaults.page),
  sort: fallback(z.string(), searchDefaults.sort).default(searchDefaults.sort),
  dir: fallback(z.string(), searchDefaults.dir).default(searchDefaults.dir),
});

export const Route = createFileRoute("/_authenticated/optimizations")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams(searchDefaults)] },
  head: () => ({
    meta: [
      { title: "Optimizations · Linsiq" },
      { name: "description", content: "Review and apply AI cost optimization recommendations across your AWS account." },
      { property: "og:title", content: "Optimizations · Linsiq" },
      { property: "og:description", content: "Review and apply AI cost optimization recommendations." },
    ],
  }),
  component: OptimizationsPage,
});

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const confidenceStyle: Record<Confidence, string> = {
  high: "bg-savings-muted text-savings border-transparent",
  medium: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-200",
  low: "bg-muted text-muted-foreground border-transparent",
};

function fmtRelative(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function OptimizationsPage() {
  const rawSearch = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  // Normalize into typed variants (URLs are strings, so validate on read).
  const confidenceFilter: "all" | Confidence =
    rawSearch.confidence === "high" || rawSearch.confidence === "medium" || rawSearch.confidence === "low"
      ? rawSearch.confidence
      : "all";
  const typeFilter = rawSearch.type || "all";
  const search = rawSearch.q ?? "";
  const minSavings = rawSearch.min ?? "";
  const maxSavings = rawSearch.max ?? "";
  const sortKey: "savings" | "confidence" | "date" =
    rawSearch.sort === "confidence" || rawSearch.sort === "date" ? rawSearch.sort : "savings";
  const sortDir: "asc" | "desc" = rawSearch.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, rawSearch.page ?? 1);

  // Update URL search params. Any filter/sort change also resets page to 1.
  const updateSearch = (
    patch: Partial<z.infer<typeof searchSchema>>,
    opts: { resetPage?: boolean } = { resetPage: true },
  ) => {
    navigate({
      search: (prev: z.infer<typeof searchSchema>) => {
        const next = { ...prev, ...patch };
        if (opts.resetPage && !("page" in patch)) next.page = 1;
        return next;
      },
      replace: true,
    });
  };

  const setConfidenceFilter = (v: "all" | Confidence) => updateSearch({ confidence: v });
  const setTypeFilter = (v: string) => updateSearch({ type: v });
  const setSearchQ = (v: string) => updateSearch({ q: v });
  const setMinSavings = (v: string) => updateSearch({ min: v });
  const setMaxSavings = (v: string) => updateSearch({ max: v });
  const setPage = (updater: number | ((p: number) => number)) => {
    const next = typeof updater === "function" ? updater(page) : updater;
    updateSearch({ page: next }, { resetPage: false });
  };

  const [items, setItems] = useState<Optimization[]>([]);
  const [total, setTotal] = useState(0);
  const [uniqueTypes, setUniqueTypes] = useState<string[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recent, setRecent] = useState<OptimizationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pageSize = 8;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search input so keystrokes don't spam the DB.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    setSearchInput(search);
  }, [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => updateSearch({ q: searchInput }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // One-time sidebar / summary data (independent of filters).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [types, acts, pending] = await Promise.all([
          listOptimizationTypes(),
          listRecentActions(20),
          queryOptimizations({ page: 1, pageSize: 1, confidence: "all" }).then(async () => {
            // Fetch aggregate pending stats: fetch all pending savings via a lean query.
            const { supabase } = await import("@/integrations/supabase/client");
            const { data, error } = await supabase
              .from("optimizations")
              .select("savings_usd")
              .eq("status", "pending");
            if (error) throw error;
            const rows = (data as { savings_usd: number | string }[]) ?? [];
            return {
              count: rows.length,
              total: rows.reduce((s, r) => s + Number(r.savings_usd), 0),
            };
          }),
        ]);
        if (cancelled) return;
        setUniqueTypes(types);
        setRecent(acts);
        setPendingCount(pending.count);
        setTotalPending(pending.total);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch the current page whenever any filter, sort, or page changes.
  useEffect(() => {
    let cancelled = false;
    const isFirst = loading;
    if (!isFirst) setRefreshing(true);
    (async () => {
      try {
        const min = minSavings === "" ? null : Number(minSavings);
        const max = maxSavings === "" ? null : Number(maxSavings);
        const res = await queryOptimizations({
          search,
          confidence: confidenceFilter,
          type: typeFilter,
          min: Number.isFinite(min as number) ? (min as number) : null,
          max: Number.isFinite(max as number) ? (max as number) : null,
          sort: sortKey,
          dir: sortDir,
          page,
          pageSize,
        });
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Failed to load optimizations");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, confidenceFilter, typeFilter, minSavings, maxSavings, sortKey, sortDir, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize;
  const paged = items;

  const toggleSort = (key: "savings" | "confidence" | "date") => {
    if (sortKey === key) {
      updateSearch({ dir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      updateSearch({ sort: key, dir: "desc" });
    }
  };

  const SortIcon = ({ k }: { k: "savings" | "confidence" | "date" }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-foreground" />
    ) : (
      <ArrowDown className="h-3 w-3 text-foreground" />
    );
  };

  // The drawer can be opened from the audit sidebar for an optimization
  // that isn't on the current page — fetch it on demand in that case.
  const [selectedOpt, setSelectedOpt] = useState<Optimization | null>(null);
  useEffect(() => {
    if (!selectedId) {
      setSelectedOpt(null);
      return;
    }
    const inPage = items.find((o) => o.id === selectedId);
    if (inPage) {
      setSelectedOpt(inPage);
      return;
    }
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("optimizations")
        .select("*")
        .eq("id", selectedId)
        .maybeSingle();
      if (cancelled || !data) return;
      const { toOptimization } = await import("@/lib/optimizations-api");
      setSelectedOpt(toOptimization(data as Parameters<typeof toOptimization>[0]));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, items]);
  const selected = selectedOpt;

  const hasActiveFilters =
    confidenceFilter !== "all" ||
    typeFilter !== "all" ||
    search !== "" ||
    minSavings !== "" ||
    maxSavings !== "";

  const clearFilters = () => {
    navigate({ search: { ...searchDefaults }, replace: true });
  };

  const apply = async (id: string) => {
    const opt = items.find((o) => o.id === id);
    if (!opt || opt.status === "applied") return;
    setApplyingId(id);
    // optimistic update
    setItems((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "applied" as OptStatus } : o)),
    );
    try {
      const { optimization, action } = await applyOptimization(opt);
      setItems((prev) => prev.map((o) => (o.id === id ? optimization : o)));
      setRecent((prev) => [action, ...prev].slice(0, 20));
      toast.success(`Applied: ${opt.type}`, {
        description: `Saving ${fmt(opt.savings_usd)}/mo · audit logged`,
      });
    } catch (e) {
      console.error(e);
      // rollback
      setItems((prev) => prev.map((o) => (o.id === id ? opt : o)));
      toast.error("Apply failed", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setApplyingId(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const min = minSavings === "" ? null : Number(minSavings);
      const max = maxSavings === "" ? null : Number(maxSavings);
      const rows = await exportFilteredOptimizations({
        search,
        confidence: confidenceFilter,
        type: typeFilter,
        min: Number.isFinite(min as number) ? (min as number) : null,
        max: Number.isFinite(max as number) ? (max as number) : null,
        sort: sortKey,
        dir: sortDir,
      });
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = [
        "id",
        "type",
        "resource",
        "service",
        "monthly_savings_usd",
        "current_cost_usd",
        "projected_cost_usd",
        "confidence",
        "status",
        "detected_at",
        "applied_at",
        "description",
      ];
      const lines = [header.join(",")];
      for (const o of rows) {
        lines.push(
          [
            o.id,
            o.type,
            o.resource_id,
            o.service,
            o.savings_usd,
            o.current_cost,
            o.projected_cost,
            o.confidence,
            o.status,
            o.created_at ?? "",
            o.applied_at ?? "",
            o.description,
          ]
            .map(esc)
            .join(","),
        );
      }
      const filterBits: string[] = [];
      if (search) filterBits.push(`q-${search}`);
      if (confidenceFilter !== "all") filterBits.push(confidenceFilter);
      if (typeFilter !== "all") filterBits.push(typeFilter);
      const stamp = new Date().toISOString().slice(0, 10);
      const slug = filterBits.length ? `-${filterBits.join("-").replace(/[^a-z0-9-]+/gi, "_")}` : "";
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `optimizations-${stamp}${slug}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? "row" : "rows"}`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Optimizations"
        description={
          loading
            ? "Loading recommendations…"
            : `${pendingCount} pending · ${fmt(totalPending)}/mo in potential savings.`
        }
        actions={
          <div className="flex items-center gap-1 rounded-md border border-input bg-card p-1">
            <Filter className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            {(["all", "high", "medium", "low"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setConfidenceFilter(f)}
                className={
                  "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors " +
                  (confidenceFilter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {f}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search type, resource, description…"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[180px] text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                inputMode="numeric"
                value={minSavings}
                onChange={(e) => setMinSavings(e.target.value)}
                placeholder="Min $"
                className="h-9 w-24 text-xs"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                inputMode="numeric"
                value={maxSavings}
                onChange={(e) => setMaxSavings(e.target.value)}
                placeholder="Max $"
                className="h-9 w-24 text-xs"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {refreshing && <Loader2 className="h-3 w-3 animate-spin" />}
              {total} {total === 1 ? "result" : "results"}
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={exporting || total === 0}
                className="h-9 text-xs"
              >
                {exporting ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1 h-3.5 w-3.5" />
                )}
                Export CSV
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Resource</th>
                  <th className="px-6 py-3 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort("savings")}
                      aria-sort={sortKey === "savings" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                      className={`ml-auto inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${sortKey === "savings" ? "text-foreground" : ""}`}
                    >
                      Monthly savings
                      <SortIcon k="savings" />
                    </button>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort("confidence")}
                      aria-sort={sortKey === "confidence" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${sortKey === "confidence" ? "text-foreground" : ""}`}
                    >
                      Confidence
                      <SortIcon k="confidence" />
                    </button>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort("date")}
                      aria-sort={sortKey === "date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${sortKey === "date" ? "text-foreground" : ""}`}
                    >
                      Detected
                      <SortIcon k="date" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className="cursor-pointer hover:bg-muted/30"
                  >
                    <td className="px-6 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{o.type}</span>
                        <Badge variant="outline" className="text-[10px]">{o.service}</Badge>
                      </div>
                      <div className="mt-1 max-w-md text-xs text-muted-foreground">{o.description}</div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="font-mono text-xs text-foreground">{o.resource_id}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {fmt(o.current_cost)} → {fmt(o.projected_cost)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right align-top">
                      <div className="font-semibold text-savings">+{fmt(o.savings_usd)}</div>
                      <div className="text-xs text-muted-foreground">per month</div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${confidenceStyle[o.confidence]}`}
                      >
                        {o.confidence}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {o.created_at ? (
                        <>
                          <div className="text-xs text-foreground">
                            {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{fmtRelative(o.created_at)}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedId(o.id)} className="text-xs">
                          Details
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="text-xs" title="View audit trail">
                          <Link to="/audit" search={{ opt: o.id }}>
                            <History className="mr-1 h-3.5 w-3.5" /> Audit
                          </Link>
                        </Button>
                        {o.status === "applied" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-savings">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Applied
                          </span>
                        ) : (
                          <Button size="sm" disabled={applyingId === o.id} onClick={() => apply(o.id)}>
                            {applyingId === o.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Applying
                              </>
                            ) : (
                              "Apply"
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && total === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      No optimizations match your filters.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <div>
                Showing <span className="font-medium text-foreground">{pageStart + 1}</span>–
                <span className="font-medium text-foreground">{Math.min(pageStart + pageSize, total)}</span>{" "}
                of <span className="font-medium text-foreground">{total}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <span className="px-2">
                  Page <span className="font-medium text-foreground">{currentPage}</span> of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>


        <Card className="p-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">Audit log</div>
            <div className="ml-auto text-[11px] text-muted-foreground">
              {recent.length} recent
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No actions yet. Apply an optimization to see it logged here.
              </div>
            ) : (
              <ul className="divide-y">
                {recent.map((a) => {
                  const opt = items.find((o) => o.id === a.optimization_id);
                  return (
                    <li
                      key={a.id}
                      className="cursor-pointer px-4 py-3 text-sm hover:bg-muted/30"
                      onClick={() => setSelectedId(a.optimization_id)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-savings/40 bg-savings-muted/40 text-[10px] capitalize text-savings"
                        >
                          {a.action}
                        </Badge>
                        <span className="text-savings font-medium">
                          +{fmt(Number(a.savings_usd))}
                        </span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {fmtRelative(a.created_at)}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-foreground">
                        {opt?.type ?? a.optimization_id}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {a.actor}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <OptimizationDetails
              opt={selected}
              applying={applyingId === selected.id}
              onApply={() => apply(selected.id)}
            />
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function OptimizationDetails({
  opt,
  onApply,
  applying,
}: {
  opt: Optimization;
  onApply: () => void;
  applying: boolean;
}) {
  const breakdownTotal = opt.savings_breakdown.reduce((s, l) => s + l.amount, 0);
  const savingsPct = opt.current_cost > 0 ? Math.round((opt.savings_usd / opt.current_cost) * 100) : 0;

  const [history, setHistory] = useState<OptimizationAction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    listActionsFor(opt.id)
      .then((h) => !cancelled && setHistory(h))
      .catch((e) => console.error(e))
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => {
      cancelled = true;
    };
    // re-fetch history when apply flips status
  }, [opt.id, opt.status]);

  return (
    <div className="flex h-full flex-col gap-6">
      <SheetHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{opt.service}</Badge>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${confidenceStyle[opt.confidence]}`}
          >
            {opt.confidence} confidence
          </span>
          {opt.status === "applied" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-savings/30 bg-savings-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-savings">
              <CheckCircle2 className="h-3 w-3" /> Applied
            </span>
          )}
        </div>
        <SheetTitle className="text-xl">{opt.type}</SheetTitle>
        <SheetDescription className="text-sm">{opt.description}</SheetDescription>
      </SheetHeader>

      <div className="rounded-lg border bg-savings-muted/40 p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Projected monthly savings
            </div>
            <div className="mt-1 text-2xl font-semibold text-savings">
              +{fmt(opt.savings_usd)}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>
              <span className="text-spend">{fmt(opt.current_cost)}</span>
              <ArrowRight className="mx-1 inline h-3 w-3" />
              <span className="text-foreground">{fmt(opt.projected_cost)}</span>
            </div>
            <div className="mt-1 font-medium text-savings">{savingsPct}% reduction</div>
          </div>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Affected resources
        </h3>
        <div className="divide-y rounded-lg border">
          {opt.affected_resources.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{r.name}</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {r.id} · {r.region}
                </div>
              </div>
              <div className="ml-4 shrink-0 text-right">
                <div className="text-sm font-medium text-foreground">{fmt(r.monthly_cost)}</div>
                <div className="text-[11px] text-muted-foreground">current / mo</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Why this confidence
        </h3>
        <p className="mb-3 text-sm text-foreground">{opt.confidence_summary}</p>
        <div className="space-y-3">
          {opt.confidence_factors.map((f) => (
            <div key={f.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{f.label}</span>
                <span className="text-muted-foreground">{f.weight}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${f.weight}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{f.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Projected savings breakdown
        </h3>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {opt.savings_breakdown.map((l) => (
                <tr key={l.label}>
                  <td className="px-4 py-2.5 text-foreground">{l.label}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-savings">
                    +{fmt(l.amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/40">
                <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-savings">
                  +{fmt(breakdownTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Implementation
        </h3>
        <p className="text-sm text-foreground">{opt.implementation_notes}</p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Action history
          </h3>
          <Link
            to="/audit"
            search={{ opt: opt.id }}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View full audit trail <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {historyLoading ? (
          <div className="rounded-lg border px-4 py-6 text-center text-xs text-muted-foreground">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-lg border px-4 py-6 text-center text-xs text-muted-foreground">
            No actions recorded yet.
          </div>
        ) : (
          <ol className="divide-y rounded-lg border">
            {history.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-savings/40 bg-savings-muted/40 text-[10px] capitalize text-savings"
                  >
                    {a.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">by {a.actor}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-savings">
                  Captured savings +{fmt(Number(a.savings_usd))}/mo
                </div>
                {a.notes && (
                  <div className="mt-1 text-xs text-muted-foreground">{a.notes}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-auto flex items-center justify-end gap-2 border-t pt-4">
        {opt.status === "applied" ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-savings">
            <CheckCircle2 className="h-4 w-4" /> Already applied
          </span>
        ) : (
          <Button onClick={onApply} disabled={applying}>
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying…
              </>
            ) : (
              "Apply optimization"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

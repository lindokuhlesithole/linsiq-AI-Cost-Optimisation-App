import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { AppLayout, PageHeader } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, DollarSign, Sparkles, ArrowRight, Download, CalendarIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  dailySpend,
  monthlySpend,
  optimizations,
  optimizationRate,
  potentialSavings,
} from "@/lib/mock-data";
import { fetchExportRows, type OptimizationExportRow } from "@/lib/optimizations-api";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Linsiq" },
      { name: "description", content: "Overview of AI spend, optimizations, and daily cost trends across SageMaker, Bedrock, and EC2 GPU." },
      { property: "og:title", content: "Dashboard · Linsiq" },
      { property: "og:description", content: "Overview of AI spend, optimizations, and daily cost trends." },
    ],
  }),
  component: DashboardPage,
});

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Kpi({
  label,
  value,
  delta,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "spend" | "savings";
  icon: typeof DollarSign;
}) {
  const toneClasses =
    tone === "spend" ? "bg-spend-muted text-spend" : "bg-savings-muted text-savings";
  const DeltaIcon = tone === "spend" ? TrendingUp : TrendingDown;
  const deltaColor = tone === "spend" ? "text-spend" : "text-savings";

  return (
    <Card className="p-6 gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClasses}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div>
      <div className={`flex items-center gap-1 text-xs font-medium ${deltaColor}`}>
        <DeltaIcon className="h-3.5 w-3.5" />
        {delta}
      </div>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function inRange(dateIso: string | undefined, from?: Date, to?: Date) {
  if (!dateIso) return true;
  const d = new Date(dateIso).getTime();
  if (from && d < from.setHours(0, 0, 0, 0)) return false;
  if (to && d > new Date(to).setHours(23, 59, 59, 999)) return false;
  return true;
}

function buildReportCsv(rows: OptimizationExportRow[], range?: DateRange) {
  const from = range?.from;
  const to = range?.to ?? range?.from;
  const spend = dailySpend.filter((d) => inRange(d.date, from, to));
  const opts = rows.filter((o) => inRange(o.created_at, from, to));
  const rangeLabel =
    from && to
      ? `${format(from, "yyyy-MM-dd")} to ${format(to, "yyyy-MM-dd")}`
      : "Last 30 days";
  const spendTotal = spend.reduce(
    (a, d) => a + d.SageMaker + d.Bedrock + d["EC2 GPU"],
    0,
  );
  const potentialTotal = opts
    .filter((o) => o.status === "pending")
    .reduce((a, o) => a + o.savings_usd, 0);
  const realizedTotal = opts.reduce((a, o) => a + o.realized_savings_usd, 0);
  const pendingCount = opts.filter((o) => o.status === "pending").length;
  const appliedCount = opts.filter((o) => o.status === "applied").length;

  const now = new Date();
  const lines: string[] = [];
  lines.push(`Linsiq cost optimization report`);
  lines.push(`Generated,${now.toISOString()}`);
  lines.push(`Date range,${rangeLabel}`);
  lines.push("");
  lines.push("KPI,Value");
  lines.push(`Spend in range (USD),${spendTotal}`);
  lines.push(`Potential savings in range (USD/mo),${potentialTotal}`);
  lines.push(`Realized savings in range (USD/mo),${realizedTotal}`);
  lines.push(`Optimization rate,${(optimizationRate * 100).toFixed(1)}%`);
  lines.push(`Pending opportunities,${pendingCount}`);
  lines.push(`Applied opportunities,${appliedCount}`);
  lines.push("");
  lines.push("Daily spend by service");
  lines.push("Date,SageMaker,Bedrock,EC2 GPU");
  for (const d of spend) {
    lines.push(
      [d.label, d.SageMaker, d.Bedrock, d["EC2 GPU"]].map(csvEscape).join(","),
    );
  }
  lines.push("");
  lines.push("Optimizations with latest audit trail");
  lines.push(
    [
      "ID",
      "Type",
      "Service",
      "Resource",
      "Status",
      "Confidence",
      "Current cost (USD/mo)",
      "Projected cost (USD/mo)",
      "Monthly savings (USD)",
      "Detected at",
      "Applied at",
      "Latest action",
      "Latest action at",
      "Latest action by",
      "Realized savings impact (USD/mo)",
      "Latest action notes",
      "Description",
    ].join(","),
  );
  for (const o of opts) {
    lines.push(
      [
        o.id,
        o.type,
        o.service,
        o.resource_id,
        o.status,
        o.confidence,
        o.current_cost,
        o.projected_cost,
        o.savings_usd,
        o.created_at ?? "",
        o.applied_at ?? "",
        o.latest_action ?? "",
        o.latest_action_at ?? "",
        o.latest_action_actor ?? "",
        o.realized_savings_usd,
        o.latest_action_notes ?? "",
        o.description,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return { csv: lines.join("\n"), spend, opts, rangeLabel };
}

async function downloadReport(range?: DateRange) {
  let rows: OptimizationExportRow[];
  try {
    rows = await fetchExportRows();
  } catch (e) {
    toast.error("Couldn't build report", {
      description: e instanceof Error ? e.message : "Try again in a moment.",
    });
    return;
  }
  const { csv, spend, opts } = buildReportCsv(rows, range);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `linsiq-report-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success("Report exported", {
    description: `${opts.length} optimizations · ${spend.length} days of spend`,
  });
}

async function downloadPdfReport(range?: DateRange) {
  let rows: OptimizationExportRow[];
  try {
    rows = await fetchExportRows();
  } catch (e) {
    toast.error("Couldn't build report", {
      description: e instanceof Error ? e.message : "Try again in a moment.",
    });
    return;
  }
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const from = range?.from;
  const to = range?.to ?? range?.from;
  const spend = dailySpend.filter((d) => inRange(d.date, from, to));
  const opts = rows.filter((o) => inRange(o.created_at, from, to));
  const rangeLabel =
    from && to
      ? `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`
      : "Last 30 days";
  const spendTotal = spend.reduce(
    (a, d) => a + d.SageMaker + d.Bedrock + d["EC2 GPU"],
    0,
  );
  const potentialTotal = opts
    .filter((o) => o.status === "pending")
    .reduce((a, o) => a + o.savings_usd, 0);
  const realizedTotal = opts.reduce((a, o) => a + o.realized_savings_usd, 0);
  const pendingCount = opts.filter((o) => o.status === "pending").length;
  const appliedCount = opts.filter((o) => o.status === "applied").length;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // Header band
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Linsiq", marginX, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Cost optimization report", marginX, 54);
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  const generated = new Date();
  doc.text(
    `Generated ${format(generated, "MMM d, yyyy · HH:mm")}`,
    pageWidth - marginX,
    34,
    { align: "right" },
  );
  doc.text(rangeLabel, pageWidth - marginX, 54, { align: "right" });

  // KPI cards
  doc.setTextColor(15, 23, 42);
  let y = 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Summary", marginX, y);
  y += 14;

  const cardGap = 10;
  const cardCount = 3;
  const cardWidth = (pageWidth - marginX * 2 - cardGap * (cardCount - 1)) / cardCount;
  const cardHeight = 68;
  const kpis: Array<{ label: string; value: string; sub: string; tone: "spend" | "savings" | "neutral" }> = [
    { label: "Spend in range", value: fmt(spendTotal), sub: `${spend.length} days`, tone: "spend" },
    { label: "Potential savings /mo", value: fmt(potentialTotal), sub: `${pendingCount} pending`, tone: "savings" },
    { label: "Realized savings /mo", value: fmt(realizedTotal), sub: `${appliedCount} applied`, tone: "savings" },
  ];
  kpis.forEach((k, i) => {
    const x = marginX + i * (cardWidth + cardGap);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidth, cardHeight, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label.toUpperCase(), x + 12, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    if (k.tone === "savings") doc.setTextColor(22, 163, 74);
    else if (k.tone === "spend") doc.setTextColor(220, 38, 38);
    else doc.setTextColor(15, 23, 42);
    doc.text(k.value, x + 12, y + 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(k.sub, x + 12, y + 58);
  });
  y += cardHeight + 20;

  // Secondary metrics row
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Optimization rate: ${(optimizationRate * 100).toFixed(1)}%    ·    Pending: ${pendingCount}    ·    Applied: ${appliedCount}    ·    Optimizations in range: ${opts.length}`,
    marginX,
    y,
  );
  y += 18;

  // Daily spend table
  autoTable(doc, {
    startY: y,
    head: [["Date", "SageMaker", "Bedrock", "EC2 GPU", "Total"]],
    body: spend.map((d) => [
      d.label,
      fmt(d.SageMaker),
      fmt(d.Bedrock),
      fmt(d["EC2 GPU"]),
      fmt(d.SageMaker + d.Bedrock + d["EC2 GPU"]),
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: marginX, right: marginX },
    didDrawPage: () => {
      // Section title only on first page draw
    },
  });

  // Optimizations table
  const confidenceRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sortedOpts = [...opts].sort(
    (a, b) =>
      b.savings_usd - a.savings_usd ||
      (confidenceRank[b.confidence] ?? 0) - (confidenceRank[a.confidence] ?? 0),
  );
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
    head: [["Type", "Service", "Resource", "Savings/mo", "Confidence", "Status", "Latest action"]],
    body: sortedOpts.map((o) => [
      o.type,
      o.service,
      o.resource_id,
      fmt(o.savings_usd),
      o.confidence,
      o.status,
      o.latest_action
        ? `${o.latest_action}${o.latest_action_at ? ` · ${format(new Date(o.latest_action_at), "MMM d")}` : ""}`
        : "—",
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      3: { halign: "right", fontStyle: "bold", textColor: [22, 163, 74] },
      4: { halign: "center" },
      5: { halign: "center" },
    },
    margin: { left: marginX, right: marginX },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 4) {
        const v = String(data.cell.raw);
        if (v === "high") data.cell.styles.textColor = [22, 163, 74];
        else if (v === "medium") data.cell.styles.textColor = [180, 83, 9];
        else if (v === "low") data.cell.styles.textColor = [100, 116, 139];
      }
      if (data.column.index === 5) {
        const v = String(data.cell.raw);
        if (v === "applied") data.cell.styles.textColor = [22, 163, 74];
        else if (v === "dismissed") data.cell.styles.textColor = [100, 116, 139];
      }
    },
  });

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Linsiq · Confidential`,
      marginX,
      doc.internal.pageSize.getHeight() - 20,
    );
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" },
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`linsiq-report-${stamp}.pdf`);
  toast.success("PDF exported", {
    description: `${opts.length} optimizations · ${spend.length} days of spend`,
  });
}

function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange | undefined;
  onChange: (r: DateRange | undefined) => void;
}) {
  const label =
    value?.from && value?.to
      ? `${format(value.from, "MMM d")} – ${format(value.to, "MMM d, yyyy")}`
      : value?.from
        ? format(value.from, "MMM d, yyyy")
        : "Last 30 days";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("justify-start text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center justify-between border-t border-border p-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            Reset
          </Button>
          <span className="pr-2 text-xs text-muted-foreground">
            {value?.from && value?.to
              ? `${Math.round((value.to.getTime() - value.from.getTime()) / 86400000) + 1} days`
              : "Pick a start and end date"}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}


function DashboardPage() {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const top = optimizations.slice(0, 3);
  const pendingCount = optimizations.filter((o) => o.status === "pending").length;

  const handleExportCsv = async () => {
    setExporting("csv");
    try {
      await downloadReport(range);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting("pdf");
    try {
      await downloadPdfReport(range);
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        description="Live overview of your AI infrastructure spend and optimization opportunities."
        actions={
          <div className="flex items-center gap-2">
            <DateRangePicker value={range} onChange={setRange} />
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exporting !== null}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exporting === "csv" ? "Exporting…" : "Export CSV"}
            </Button>
            <Button size="sm" onClick={handleExportPdf} disabled={exporting !== null}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              {exporting === "pdf" ? "Exporting…" : "Export PDF"}
            </Button>
          </div>
        }
      />




      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          label="Monthly spend"
          value={fmt(monthlySpend)}
          delta="+8.2% vs. last month"
          tone="spend"
          icon={DollarSign}
        />
        <Kpi
          label="Potential savings"
          value={fmt(potentialSavings)}
          delta={`${pendingCount} opportunities`}
          tone="savings"
          icon={Sparkles}
        />
        <Kpi
          label="Optimization rate"
          value={`${Math.round(optimizationRate * 100)}%`}
          delta="+6 pts vs. last month"
          tone="savings"
          icon={TrendingDown}
        />
      </div>

      <Card className="mt-6 p-6 gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Daily AI spend by service</h2>
            <p className="mt-1 text-sm text-muted-foreground">Last 30 days · all regions</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <LegendDot color="var(--color-chart-1)" label="SageMaker" />
            <LegendDot color="var(--color-chart-2)" label="Bedrock" />
            <LegendDot color="var(--color-chart-3)" label="EC2 GPU" />
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailySpend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval={3}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => fmt(v)}
              />
              <Line type="monotone" dataKey="SageMaker" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Bedrock" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="EC2 GPU" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-6 p-6 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Top optimization opportunities</h2>
            <p className="mt-1 text-sm text-muted-foreground">Highest-impact recommendations right now.</p>
          </div>
          <Link
            to="/optimizations"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {top.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{o.type}</span>
                  <Badge variant="secondary" className="text-[10px]">{o.service}</Badge>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{o.resource_id}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-savings">+{fmt(o.savings_usd)}/mo</div>
                <div className="text-xs text-muted-foreground capitalize">{o.confidence} confidence</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AppLayout>
  );
}

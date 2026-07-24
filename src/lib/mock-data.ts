export type Service = "SageMaker" | "Bedrock" | "EC2 GPU";

export const services: Service[] = ["SageMaker", "Bedrock", "EC2 GPU"];

// 30 days of daily spend per service
function seed(base: number, variance: number, i: number, phase: number) {
  return Math.max(0, base + Math.sin(i / 3 + phase) * variance + (i % 5) * (variance / 8));
}

export const dailySpend = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  return {
    date: d.toISOString().slice(0, 10),
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    SageMaker: Math.round(seed(920, 180, i, 0)),
    Bedrock: Math.round(seed(640, 220, i, 1.4)),
    "EC2 GPU": Math.round(seed(1180, 260, i, 2.8)),
  };
});

export const monthlySpend = dailySpend.reduce(
  (acc, d) => acc + d.SageMaker + d.Bedrock + d["EC2 GPU"],
  0,
);

export type Confidence = "high" | "medium" | "low";
export type OptStatus = "pending" | "applied" | "dismissed";

export interface AffectedResource {
  id: string;
  name: string;
  region: string;
  monthly_cost: number;
}

export interface SavingsLine {
  label: string;
  amount: number;
}

export interface ConfidenceFactor {
  label: string;
  weight: number; // 0-100
  detail: string;
}

export interface Optimization {
  id: string;
  type: string;
  resource_id: string;
  service: Service;
  current_cost: number;
  projected_cost: number;
  savings_usd: number;
  confidence: Confidence;
  status: OptStatus;
  description: string;
  affected_resources: AffectedResource[];
  confidence_summary: string;
  confidence_factors: ConfidenceFactor[];
  savings_breakdown: SavingsLine[];
  implementation_notes: string;
  created_at?: string;
  applied_at?: string | null;
}

export const optimizations: Optimization[] = [
  {
    id: "opt_01",
    type: "Right-size instance",
    resource_id: "ml.p3.8xlarge / notebook-prod-04",
    service: "SageMaker",
    current_cost: 2840,
    projected_cost: 1120,
    savings_usd: 1720,
    confidence: "high",
    status: "pending",
    description: "GPU utilization averaged 18% over 14 days. Downsize to ml.p3.2xlarge.",
    affected_resources: [
      { id: "nb-prod-04", name: "notebook-prod-04", region: "us-east-1", monthly_cost: 2840 },
    ],
    confidence_summary:
      "14 days of CloudWatch metrics show sustained low GPU utilization with no memory pressure — a safe downsize.",
    confidence_factors: [
      { label: "GPU utilization signal", weight: 92, detail: "P95 utilization 24%, mean 18%" },
      { label: "Memory headroom", weight: 88, detail: "Peak GPU memory 31% of ml.p3.2xlarge capacity" },
      { label: "Workload stability", weight: 80, detail: "No traffic spikes in trailing 30 days" },
    ],
    savings_breakdown: [
      { label: "Instance hours (ml.p3.8xlarge → 2xlarge)", amount: 1520 },
      { label: "Attached EBS reduction", amount: 140 },
      { label: "Data transfer avoided", amount: 60 },
    ],
    implementation_notes:
      "Stop the notebook, change instance type, restart. ~4 min downtime. Fully reversible.",
  },
  {
    id: "opt_02",
    type: "Switch model tier",
    resource_id: "claude-3-opus → claude-3-sonnet",
    service: "Bedrock",
    current_cost: 1980,
    projected_cost: 640,
    savings_usd: 1340,
    confidence: "high",
    status: "pending",
    description: "82% of prompts benchmarked identical output quality on Sonnet.",
    affected_resources: [
      { id: "bedrock-chatbot", name: "chatbot-api (prod)", region: "us-east-1", monthly_cost: 1420 },
      { id: "bedrock-summarize", name: "summarize-worker", region: "us-east-1", monthly_cost: 560 },
    ],
    confidence_summary:
      "Offline eval on 2,400 prompts shows Sonnet matches Opus on quality for the dominant traffic pattern.",
    confidence_factors: [
      { label: "Eval parity", weight: 90, detail: "82% exact-match, 96% rubric-equivalent" },
      { label: "Traffic coverage", weight: 85, detail: "Eval set covers top 12 intents (94% of traffic)" },
      { label: "Latency budget", weight: 78, detail: "Sonnet p95 425ms vs Opus 610ms — within SLO" },
    ],
    savings_breakdown: [
      { label: "Input token pricing delta", amount: 780 },
      { label: "Output token pricing delta", amount: 520 },
      { label: "Reduced retry volume", amount: 40 },
    ],
    implementation_notes:
      "Roll out via 10 → 50 → 100% traffic shift on the model alias. Auto-rollback wired to eval score.",
  },
  {
    id: "opt_03",
    type: "Idle resource",
    resource_id: "i-0af23bce991 (g5.12xlarge)",
    service: "EC2 GPU",
    current_cost: 3120,
    projected_cost: 0,
    savings_usd: 3120,
    confidence: "high",
    status: "pending",
    description: "No GPU activity in 21 days. Recommend stop + snapshot.",
    affected_resources: [
      { id: "i-0af23bce991", name: "gpu-worker-legacy", region: "us-west-2", monthly_cost: 3120 },
    ],
    confidence_summary:
      "GPU has been fully idle for 21 days and the attached workload has been decommissioned in the deployment registry.",
    confidence_factors: [
      { label: "Utilization", weight: 98, detail: "0% GPU, <1% CPU for 21d" },
      { label: "Network activity", weight: 95, detail: "No inbound traffic since last deploy" },
      { label: "Owner confirmation", weight: 70, detail: "Team tag points to sunset project" },
    ],
    savings_breakdown: [
      { label: "Instance runtime", amount: 2880 },
      { label: "Attached EBS volumes", amount: 180 },
      { label: "Elastic IP", amount: 60 },
    ],
    implementation_notes:
      "Snapshot root volume, stop the instance. Full teardown scheduled 14 days later if no rollback request.",
  },
  {
    id: "opt_04",
    type: "Reserved capacity",
    resource_id: "3× ml.g5.2xlarge training fleet",
    service: "SageMaker",
    current_cost: 4260,
    projected_cost: 2980,
    savings_usd: 1280,
    confidence: "medium",
    status: "pending",
    description: "Sustained 84% usage over 60d. 1-yr savings plan projected.",
    affected_resources: [
      { id: "train-01", name: "training-fleet-01", region: "us-east-1", monthly_cost: 1420 },
      { id: "train-02", name: "training-fleet-02", region: "us-east-1", monthly_cost: 1420 },
      { id: "train-03", name: "training-fleet-03", region: "us-east-1", monthly_cost: 1420 },
    ],
    confidence_summary:
      "Utilization has held above 80% for two months, but a 1-year commitment adds inflexibility if roadmap shifts.",
    confidence_factors: [
      { label: "Utilization history", weight: 82, detail: "84% mean over 60d, 71% floor" },
      { label: "Commitment risk", weight: 55, detail: "Fleet size overlaps with Q4 replatforming plan" },
      { label: "Break-even horizon", weight: 68, detail: "Payback in 4.2 months" },
    ],
    savings_breakdown: [
      { label: "1-yr Savings Plan discount", amount: 1120 },
      { label: "Reduced on-demand overflow", amount: 160 },
    ],
    implementation_notes:
      "Commit at 70% of baseline to keep headroom for spot bursts. Review quarterly.",
  },
  {
    id: "opt_05",
    type: "Prompt caching",
    resource_id: "chatbot-api / titan-embed",
    service: "Bedrock",
    current_cost: 890,
    projected_cost: 410,
    savings_usd: 480,
    confidence: "medium",
    status: "pending",
    description: "37% of embedding calls are exact duplicates within 24h.",
    affected_resources: [
      { id: "svc-chatbot", name: "chatbot-api", region: "us-east-1", monthly_cost: 620 },
      { id: "svc-search", name: "semantic-search", region: "us-east-1", monthly_cost: 270 },
    ],
    confidence_summary:
      "Dedup analysis is clear, but savings depend on rollout across two services with different cache TTL needs.",
    confidence_factors: [
      { label: "Duplicate rate", weight: 90, detail: "37% exact SHA match within 24h window" },
      { label: "Cache hit consistency", weight: 60, detail: "Semantic-search sees drift after 12h" },
      { label: "Engineering effort", weight: 55, detail: "Shared cache layer required" },
    ],
    savings_breakdown: [
      { label: "Embedding call reduction", amount: 360 },
      { label: "Downstream storage writes", amount: 80 },
      { label: "Egress reduction", amount: 40 },
    ],
    implementation_notes:
      "Deploy Redis-backed cache with 12h TTL. Feature-flagged per service.",
  },
  {
    id: "opt_06",
    type: "Spot instance",
    resource_id: "i-071ac82fed2 (p4d.24xlarge)",
    service: "EC2 GPU",
    current_cost: 5820,
    projected_cost: 2340,
    savings_usd: 3480,
    confidence: "low",
    status: "pending",
    description: "Batch training workload; interruption-tolerant per tag.",
    affected_resources: [
      { id: "i-071ac82fed2", name: "batch-train-p4d", region: "us-east-1", monthly_cost: 5820 },
    ],
    confidence_summary:
      "Big potential upside, but p4d spot capacity is volatile and checkpointing hasn't been verified end-to-end.",
    confidence_factors: [
      { label: "Interruption tolerance", weight: 70, detail: "Tag asserts checkpoints every 15 min" },
      { label: "Spot capacity risk", weight: 35, detail: "p4d.24xlarge availability tight in us-east-1" },
      { label: "Fallback path", weight: 45, detail: "On-demand fallback not automated yet" },
    ],
    savings_breakdown: [
      { label: "Spot vs on-demand delta", amount: 3200 },
      { label: "Reduced idle time via bin-packing", amount: 280 },
    ],
    implementation_notes:
      "Wire spot-fallback launch template and validate checkpoint restore before cutover.",
  },
  {
    id: "opt_07",
    type: "Region migration",
    resource_id: "bedrock-endpoint-eu-west-1",
    service: "Bedrock",
    current_cost: 1240,
    projected_cost: 980,
    savings_usd: 260,
    confidence: "low",
    status: "pending",
    description: "us-east-1 pricing is 21% lower; latency delta acceptable.",
    affected_resources: [
      { id: "bedrock-eu", name: "bedrock-endpoint-eu-west-1", region: "eu-west-1", monthly_cost: 1240 },
    ],
    confidence_summary:
      "Modest savings and potential compliance implications for EU-resident traffic.",
    confidence_factors: [
      { label: "Pricing delta", weight: 80, detail: "21% lower list price in us-east-1" },
      { label: "Latency budget", weight: 50, detail: "+70ms p95 for EU users" },
      { label: "Data residency", weight: 30, detail: "Requires legal review for GDPR path" },
    ],
    savings_breakdown: [
      { label: "Region pricing delta", amount: 220 },
      { label: "Consolidated endpoint overhead", amount: 40 },
    ],
    implementation_notes:
      "Requires DPO sign-off. Consider dual-region routing before full migration.",
  },
];

export const potentialSavings = optimizations
  .filter((o) => o.status === "pending")
  .reduce((s, o) => s + o.savings_usd, 0);

export const optimizationRate = 0.34; // 34%

-- Optimizations table
CREATE TABLE public.optimizations (
  id text PRIMARY KEY,
  type text NOT NULL,
  resource_id text NOT NULL,
  service text NOT NULL,
  current_cost numeric NOT NULL DEFAULT 0,
  projected_cost numeric NOT NULL DEFAULT 0,
  savings_usd numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL CHECK (confidence IN ('high','medium','low')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed')),
  description text NOT NULL DEFAULT '',
  affected_resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_summary text NOT NULL DEFAULT '',
  confidence_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  savings_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  implementation_notes text NOT NULL DEFAULT '',
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.optimizations TO anon, authenticated;
GRANT ALL ON public.optimizations TO service_role;

ALTER TABLE public.optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read optimizations" ON public.optimizations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public update optimizations" ON public.optimizations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public insert optimizations" ON public.optimizations FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.optimization_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  optimization_id text NOT NULL REFERENCES public.optimizations(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('applied','dismissed','reverted')),
  actor text NOT NULL DEFAULT 'demo@linsiq.io',
  savings_usd numeric NOT NULL DEFAULT 0,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_optimization_actions_opt ON public.optimization_actions(optimization_id, created_at DESC);
CREATE INDEX idx_optimization_actions_created ON public.optimization_actions(created_at DESC);

GRANT SELECT, INSERT ON public.optimization_actions TO anon, authenticated;
GRANT ALL ON public.optimization_actions TO service_role;

ALTER TABLE public.optimization_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read actions" ON public.optimization_actions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert actions" ON public.optimization_actions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_optimizations_updated
BEFORE UPDATE ON public.optimizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.optimizations (id,type,resource_id,service,current_cost,projected_cost,savings_usd,confidence,description,affected_resources,confidence_summary,confidence_factors,savings_breakdown,implementation_notes) VALUES
('opt_01','Right-size instance','ml.p3.8xlarge / notebook-prod-04','SageMaker',2840,1120,1720,'high','GPU utilization averaged 18% over 14 days. Downsize to ml.p3.2xlarge.','[{"id": "nb-prod-04", "name": "notebook-prod-04", "region": "us-east-1", "monthly_cost": 2840}]'::jsonb,'14 days of CloudWatch metrics show sustained low GPU utilization with no memory pressure — a safe downsize.','[{"label": "GPU utilization signal", "weight": 92, "detail": "P95 utilization 24%, mean 18%"}, {"label": "Memory headroom", "weight": 88, "detail": "Peak GPU memory 31% of ml.p3.2xlarge capacity"}, {"label": "Workload stability", "weight": 80, "detail": "No traffic spikes in trailing 30 days"}]'::jsonb,'[{"label": "Instance hours (ml.p3.8xlarge → 2xlarge)", "amount": 1520}, {"label": "Attached EBS reduction", "amount": 140}, {"label": "Data transfer avoided", "amount": 60}]'::jsonb,'Stop the notebook, change instance type, restart. ~4 min downtime. Fully reversible.'),
('opt_02','Switch model tier','claude-3-opus → claude-3-sonnet','Bedrock',1980,640,1340,'high','82% of prompts benchmarked identical output quality on Sonnet.','[{"id": "bedrock-chatbot", "name": "chatbot-api (prod)", "region": "us-east-1", "monthly_cost": 1420}, {"id": "bedrock-summarize", "name": "summarize-worker", "region": "us-east-1", "monthly_cost": 560}]'::jsonb,'Offline eval on 2,400 prompts shows Sonnet matches Opus on quality for the dominant traffic pattern.','[{"label": "Eval parity", "weight": 90, "detail": "82% exact-match, 96% rubric-equivalent"}, {"label": "Traffic coverage", "weight": 85, "detail": "Eval set covers top 12 intents (94% of traffic)"}, {"label": "Latency budget", "weight": 78, "detail": "Sonnet p95 425ms vs Opus 610ms — within SLO"}]'::jsonb,'[{"label": "Input token pricing delta", "amount": 780}, {"label": "Output token pricing delta", "amount": 520}, {"label": "Reduced retry volume", "amount": 40}]'::jsonb,'Roll out via 10 → 50 → 100% traffic shift on the model alias. Auto-rollback wired to eval score.'),
('opt_03','Idle resource','i-0af23bce991 (g5.12xlarge)','EC2 GPU',3120,0,3120,'high','No GPU activity in 21 days. Recommend stop + snapshot.','[{"id": "i-0af23bce991", "name": "gpu-worker-legacy", "region": "us-west-2", "monthly_cost": 3120}]'::jsonb,'GPU has been fully idle for 21 days and the attached workload has been decommissioned in the deployment registry.','[{"label": "Utilization", "weight": 98, "detail": "0% GPU, <1% CPU for 21d"}, {"label": "Network activity", "weight": 95, "detail": "No inbound traffic since last deploy"}, {"label": "Owner confirmation", "weight": 70, "detail": "Team tag points to sunset project"}]'::jsonb,'[{"label": "Instance runtime", "amount": 2880}, {"label": "Attached EBS volumes", "amount": 180}, {"label": "Elastic IP", "amount": 60}]'::jsonb,'Snapshot root volume, stop the instance. Full teardown scheduled 14 days later if no rollback request.'),
('opt_04','Reserved capacity','3× ml.g5.2xlarge training fleet','SageMaker',4260,2980,1280,'medium','Sustained 84% usage over 60d. 1-yr savings plan projected.','[{"id": "train-01", "name": "training-fleet-01", "region": "us-east-1", "monthly_cost": 1420}, {"id": "train-02", "name": "training-fleet-02", "region": "us-east-1", "monthly_cost": 1420}, {"id": "train-03", "name": "training-fleet-03", "region": "us-east-1", "monthly_cost": 1420}]'::jsonb,'Utilization has held above 80% for two months, but a 1-year commitment adds inflexibility if roadmap shifts.','[{"label": "Utilization history", "weight": 82, "detail": "84% mean over 60d, 71% floor"}, {"label": "Commitment risk", "weight": 55, "detail": "Fleet size overlaps with Q4 replatforming plan"}, {"label": "Break-even horizon", "weight": 68, "detail": "Payback in 4.2 months"}]'::jsonb,'[{"label": "1-yr Savings Plan discount", "amount": 1120}, {"label": "Reduced on-demand overflow", "amount": 160}]'::jsonb,'Commit at 70% of baseline to keep headroom for spot bursts. Review quarterly.'),
('opt_05','Prompt caching','chatbot-api / titan-embed','Bedrock',890,410,480,'medium','37% of embedding calls are exact duplicates within 24h.','[{"id": "svc-chatbot", "name": "chatbot-api", "region": "us-east-1", "monthly_cost": 620}, {"id": "svc-search", "name": "semantic-search", "region": "us-east-1", "monthly_cost": 270}]'::jsonb,'Dedup analysis is clear, but savings depend on rollout across two services with different cache TTL needs.','[{"label": "Duplicate rate", "weight": 90, "detail": "37% exact SHA match within 24h window"}, {"label": "Cache hit consistency", "weight": 60, "detail": "Semantic-search sees drift after 12h"}, {"label": "Engineering effort", "weight": 55, "detail": "Shared cache layer required"}]'::jsonb,'[{"label": "Embedding call reduction", "amount": 360}, {"label": "Downstream storage writes", "amount": 80}, {"label": "Egress reduction", "amount": 40}]'::jsonb,'Deploy Redis-backed cache with 12h TTL. Feature-flagged per service.'),
('opt_06','Spot instance','i-071ac82fed2 (p4d.24xlarge)','EC2 GPU',5820,2340,3480,'low','Batch training workload; interruption-tolerant per tag.','[{"id": "i-071ac82fed2", "name": "batch-train-p4d", "region": "us-east-1", "monthly_cost": 5820}]'::jsonb,'Big potential upside, but p4d spot capacity is volatile and checkpointing hasn''t been verified end-to-end.','[{"label": "Interruption tolerance", "weight": 70, "detail": "Tag asserts checkpoints every 15 min"}, {"label": "Spot capacity risk", "weight": 35, "detail": "p4d.24xlarge availability tight in us-east-1"}, {"label": "Fallback path", "weight": 45, "detail": "On-demand fallback not automated yet"}]'::jsonb,'[{"label": "Spot vs on-demand delta", "amount": 3200}, {"label": "Reduced idle time via bin-packing", "amount": 280}]'::jsonb,'Wire spot-fallback launch template and validate checkpoint restore before cutover.'),
('opt_07','Region migration','bedrock-endpoint-eu-west-1','Bedrock',1240,980,260,'low','us-east-1 pricing is 21% lower; latency delta acceptable.','[{"id": "bedrock-eu", "name": "bedrock-endpoint-eu-west-1", "region": "eu-west-1", "monthly_cost": 1240}]'::jsonb,'Modest savings and potential compliance implications for EU-resident traffic.','[{"label": "Pricing delta", "weight": 80, "detail": "21% lower list price in us-east-1"}, {"label": "Latency budget", "weight": 50, "detail": "+70ms p95 for EU users"}, {"label": "Data residency", "weight": 30, "detail": "Requires legal review for GDPR path"}]'::jsonb,'[{"label": "Region pricing delta", "amount": 220}, {"label": "Consolidated endpoint overhead", "amount": 40}]'::jsonb,'Requires DPO sign-off. Consider dual-region routing before full migration.');
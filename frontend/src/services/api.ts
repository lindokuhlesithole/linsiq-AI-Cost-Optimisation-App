/**
 * Linsiq API Client
 * Centralized HTTP client for communicating with the FastAPI backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// --- HTTP Utilities ---

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = localStorage.getItem("linsiq_auth_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      errorBody.detail || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorBody
    );
  }

  // Handle empty responses
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isNotFound() {
    return this.status === 404;
  }
}

// --- Health ---

export interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
}

export function getHealth(): Promise<HealthStatus> {
  return http<HealthStatus>("/health");
}

// --- Costs ---

export interface CostSummary {
  total_monthly_cost: number;
  ai_services_cost: number;
  trend: "increasing" | "decreasing" | "stable";
  change_percent: number;
}

export interface CostByService {
  service: string;
  cost: number;
  percentage?: number;
}

export interface CostByResource {
  resource_id: string;
  resource_type: string;
  cost: number;
  region: string;
}

export function getCostSummary(): Promise<CostSummary> {
  return http<CostSummary>("/api/v1/costs/summary");
}

export function getCostsByService(): Promise<CostByService[]> {
  return http<CostByService[]>("/api/v1/costs/by-service");
}

export function getCostsByResource(): Promise<CostByResource[]> {
  return http<CostByResource[]>("/api/v1/costs/by-resource");
}

// --- Waste Detection ---

export interface WasteFinding {
  id: string;
  resource_id: string;
  resource_type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  potential_savings: number;
  status: "active" | "dismissed" | "resolved";
  created_at: string;
}

export interface WasteScanResult {
  scan_id: string;
  findings: WasteFinding[];
  total_potential_savings: number;
}

export function triggerWasteScan(): Promise<WasteScanResult> {
  return http<WasteScanResult>("/api/v1/waste/scan", { method: "POST" });
}

export function getWasteFindings(params?: {
  severity?: string;
  status?: string;
}): Promise<WasteFinding[]> {
  const query = params
    ? "?" +
      new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined) as [
          string,
          string,
        ][]
      ).toString()
    : "";
  return http<WasteFinding[]>(`/api/v1/waste/findings${query}`);
}

export function dismissWasteFinding(id: string): Promise<WasteFinding> {
  return http<WasteFinding>(`/api/v1/waste/findings/${id}/dismiss`, {
    method: "POST",
  });
}

// --- Optimizations ---

export type OptimizationStatus =
  | "pending"
  | "approved"
  | "applied"
  | "rolled_back"
  | "rejected";

export interface Optimization {
  id: string;
  resource_id: string;
  resource_type: string;
  current_config: string;
  recommended_config: string;
  reason: string;
  potential_savings: number;
  status: OptimizationStatus;
  created_at: string;
  applied_at?: string;
  rolled_back_at?: string;
}

export interface CreateOptimizationPayload {
  resource_id: string;
  resource_type: string;
  current_config: string;
  recommended_config: string;
  reason: string;
  potential_savings: number;
}

export function createOptimization(
  payload: CreateOptimizationPayload
): Promise<Optimization> {
  return http<Optimization>("/api/v1/optimizations/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listOptimizations(): Promise<Optimization[]> {
  return http<Optimization[]>("/api/v1/optimizations/");
}

export function getOptimization(id: string): Promise<Optimization> {
  return http<Optimization>(`/api/v1/optimizations/${id}`);
}

export function approveOptimization(id: string): Promise<Optimization> {
  return http<Optimization>(`/api/v1/optimizations/${id}/approve`, {
    method: "POST",
  });
}

export function applyOptimization(id: string): Promise<Optimization> {
  return http<Optimization>(`/api/v1/optimizations/${id}/apply`, {
    method: "POST",
  });
}

export function rollbackOptimization(id: string): Promise<Optimization> {
  return http<Optimization>(`/api/v1/optimizations/${id}/rollback`, {
    method: "POST",
  });
}

// --- Dashboard ---

export interface DashboardSummary {
  total_cost: number;
  ai_cost: number;
  cost_change_percent: number;
  active_findings: number;
  total_potential_savings: number;
  optimizations_applied: number;
  optimizations_pending: number;
  actual_savings: number;
}

export interface DashboardTrends {
  dates: string[];
  costs: number[];
  ai_costs: number[];
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return http<DashboardSummary>("/api/v1/dashboard/summary");
}

export function getDashboardTrends(): Promise<DashboardTrends> {
  return http<DashboardTrends>("/api/v1/dashboard/trends");
}

// --- Audit Log ---

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  user_id?: string;
  created_at: string;
}

export function getAuditLog(params?: {
  resource_type?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const query = params
    ? "?" +
      new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined) as [
          string,
          string,
        ][]
      ).toString()
    : "";
  return http<AuditLogEntry[]>(`/api/v1/audit/log${query}`);
}

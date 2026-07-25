/**
 * TypeScript type definitions for the Linsiq API.
 * Mirror of the backend Pydantic/FastAPI models.
 */

// Re-export all types from the API service for cleaner imports
export * from "../services/api";

// Additional frontend-specific types

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface TimeSeriesChart {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ResourceMetrics {
  cpu_utilization: number;
  memory_utilization: number;
  network_in: number;
  network_out: number;
  invocations: number;
  latency_p99: number;
}

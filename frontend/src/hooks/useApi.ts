/**
 * React hooks for Linsiq API data fetching.
 * Provides loading states, error handling, and caching.
 */
import { useState, useEffect, useCallback } from "react";
import { ApiError } from "../services/api";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

export function useApi<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFn()
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setError(err);
        } else {
          setError(
            new ApiError(
              err instanceof Error ? err.message : "Unknown error",
              0,
              {}
            )
          );
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// Convenience hooks for common endpoints

import {
  getHealth,
  getCostSummary,
  getCostsByService,
  getCostsByResource,
  getWasteFindings,
  triggerWasteScan,
  listOptimizations,
  getDashboardSummary,
  getDashboardTrends,
  type HealthStatus,
  type CostSummary,
  type CostByService,
  type CostByResource,
  type WasteFinding,
  type Optimization,
  type DashboardSummary,
  type DashboardTrends,
} from "../services/api";

export function useHealth() {
  return useApi<HealthStatus>(getHealth);
}

export function useCostSummary() {
  return useApi<CostSummary>(getCostSummary);
}

export function useCostsByService() {
  return useApi<CostByService[]>(getCostsByService);
}

export function useCostsByResource() {
  return useApi<CostByResource[]>(getCostsByResource);
}

export function useWasteFindings(filters?: {
  severity?: string;
  status?: string;
}) {
  return useApi<WasteFinding[]>(() => getWasteFindings(filters), [
    filters?.severity,
    filters?.status,
  ]);
}

export function useOptimizations() {
  return useApi<Optimization[]>(listOptimizations);
}

export function useDashboardSummary() {
  return useApi<DashboardSummary>(getDashboardSummary);
}

export function useDashboardTrends() {
  return useApi<DashboardTrends>(getDashboardTrends);
}

// Mutation hooks (POST/PUT/DELETE)

interface UseMutationState<T, P> {
  mutate: (payload: P) => Promise<T>;
  loading: boolean;
  error: ApiError | null;
  data: T | null;
}

export function useMutation<T, P>(
  mutateFn: (payload: P) => Promise<T>
): UseMutationState<T, P> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (payload: P) => {
      setLoading(true);
      setError(null);
      try {
        const result = await mutateFn(payload);
        setData(result);
        return result;
      } catch (err: unknown) {
        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError(
                err instanceof Error ? err.message : "Unknown error",
                0,
                {}
              );
        setError(apiErr);
        throw apiErr;
      } finally {
        setLoading(false);
      }
    },
    [mutateFn]
  );

  return { mutate, loading, error, data };
}

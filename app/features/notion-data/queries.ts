import { queryOptions } from '@tanstack/react-query';
import type { CampfireDashboard, SessionLookupResult } from '~/lib/notion';

import {
  getCampfireDashboard,
  getSessionForDate,
  NotionResourceRateLimitError,
} from '~/lib/apis';
import { getQueryKeys } from '~/lib/query-keys';

interface DashboardQueryOptionsParams {
  refetchInterval: number | false;
}

interface SessionQueryOptionsParams {
  date: string;
  refetchInterval: number | false;
}

function retryNotionRateLimit(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof NotionResourceRateLimitError;
}

function getNotionRetryDelay(_: number, error: unknown): number {
  if (error instanceof NotionResourceRateLimitError) return error.retryAfterMs;
  return 0;
}

export const getCampfireDashboardQueryOptions = ({ refetchInterval }: Readonly<DashboardQueryOptionsParams>) =>
  queryOptions<CampfireDashboard>({
    queryKey: getQueryKeys.notionDashboard(),
    queryFn: getCampfireDashboard,
    staleTime: 75_000,
    refetchInterval,
    refetchIntervalInBackground: false,
    retry: retryNotionRateLimit,
    retryDelay: getNotionRetryDelay,
  });

export const getSessionForDateQueryOptions = ({ date, refetchInterval }: Readonly<SessionQueryOptionsParams>) =>
  queryOptions<SessionLookupResult>({
    queryKey: getQueryKeys.notionSession({ date }),
    queryFn: () => getSessionForDate({ date }),
    staleTime: 30_000,
    refetchInterval,
    refetchIntervalInBackground: false,
    retry: retryNotionRateLimit,
    retryDelay: getNotionRetryDelay,
  });

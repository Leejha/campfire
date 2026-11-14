import type { CampfireDashboard, SessionLookupResult } from '~/lib/notion';

export class NotionResourceRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor({ retryAfterMs }: Readonly<{ retryAfterMs: number }>) {
    super('Notion 요청이 잠시 많아요. 잠시 후 다시 시도해 주세요.');
    this.name = 'NotionResourceRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

async function getNotionResource<ResponseData>({ path }: Readonly<{ path: string }>): Promise<ResponseData> {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (response.status === 429) throw await createRateLimitError({ response });
  if (!response.ok) throw new Error(`Notion 데이터를 불러오지 못했어요. (${response.status})`);
  return response.json();
}

async function createRateLimitError({ response }: Readonly<{ response: Response }>): Promise<NotionResourceRateLimitError> {
  const body = await getRateLimitBody({ response });
  const headerSeconds = toPositiveNumber({ value: response.headers.get('Retry-After') });
  const retryAfterSeconds = headerSeconds ?? getBodyRetryAfterSeconds({ body });
  return new NotionResourceRateLimitError({ retryAfterMs: retryAfterSeconds * 1_000 });
}

async function getRateLimitBody({ response }: Readonly<{ response: Response }>): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getBodyRetryAfterSeconds({ body }: Readonly<{ body: unknown }>): number {
  if (!isRecord(body)) return 1;
  return toPositiveNumber({ value: body.retryAfterSeconds }) ?? 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPositiveNumber({ value }: Readonly<{ value: unknown }>): number | null {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  if (typeof numberValue !== 'number' || !Number.isFinite(numberValue) || numberValue <= 0) return null;
  return numberValue;
}

export const getCampfireDashboard = async (): Promise<CampfireDashboard> => {
  return getNotionResource<CampfireDashboard>({ path: '/api/notion/dashboard' });
};

interface GetSessionForDateRequest {
  date: string;
}

export const getSessionForDate = async ({ date }: Readonly<GetSessionForDateRequest>): Promise<SessionLookupResult> => {
  return getNotionResource<SessionLookupResult>({
    path: `/api/notion/session?${new URLSearchParams({ date })}`,
  });
};

import { env } from 'cloudflare:workers';

import { getSessionForDate, NotionRateLimitError } from '~/lib/notion';

import type { Route } from './+types/api.notion-session';

function jsonResponse({ body, status, headers }: Readonly<{ body: unknown; status: number; headers: HeadersInit }>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  const date = new URL(request.url).searchParams.get('date');
  if (date === null) return jsonResponse({ body: { message: 'date가 필요해요.' }, status: 400, headers: {} });

  try {
    const session = await getSessionForDate({ env, date });
    return jsonResponse({ body: session, status: 200, headers: {} });
  } catch (error: unknown) {
    if (error instanceof NotionRateLimitError) {
      return jsonResponse({
        body: { retryAfterSeconds: error.retryAfterSeconds },
        status: 429,
        headers: { 'Retry-After': String(error.retryAfterSeconds) },
      });
    }
    throw error;
  }
}

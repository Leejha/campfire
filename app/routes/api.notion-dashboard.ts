import { env } from 'cloudflare:workers';

import { readDashboardResponse } from '~/features/notion-data/server-index';

import type { Route } from './+types/api.notion-dashboard';

export async function loader(_: Route.LoaderArgs): Promise<Response> {
  return readDashboardResponse({ db: env.DB });
}

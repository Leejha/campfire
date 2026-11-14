import { createRequestHandler } from "react-router";
import { syncNotionDashboard } from '../app/features/notion-data/server-index';

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async scheduled(_controller, env) {
    await syncNotionDashboard({ db: env.DB, env });
  },
  async fetch(request) {
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;

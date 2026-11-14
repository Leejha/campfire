import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("stats", "routes/stats.tsx"),
  route("display", "routes/display.tsx"),
  route("session", "routes/session.tsx"),
  route("api/notion/dashboard", "routes/api.notion-dashboard.ts"),
  route("api/notion/session", "routes/api.notion-session.ts"),
] satisfies RouteConfig;

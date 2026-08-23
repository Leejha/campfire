import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("stats", "routes/stats.tsx"),
  route("invite", "routes/invite.tsx"),
  route("invite/open", "routes/invite-open.tsx"),
  route("display", "routes/display.tsx"),
] satisfies RouteConfig;

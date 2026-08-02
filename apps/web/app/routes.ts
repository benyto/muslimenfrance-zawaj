import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/login", "routes/auth/login.tsx"),
  route("auth/verify", "routes/auth/verify.tsx"),

  layout("lib/auth/RequireAuth.tsx", [
    layout("components/layout/AppShell.tsx", [
      route("discover", "routes/discover/index.tsx"),
      route("messages", "routes/messages/index.tsx"),
      route("profile/me", "routes/profile/me.tsx"),
      route("profile/:id", "routes/profile/$id.tsx"),
      route("settings", "routes/settings/index.tsx"),

      layout("lib/auth/RequireAdmin.tsx", [
        route("admin", "routes/admin/index.tsx"),
      ]),
    ]),
  ]),
] satisfies RouteConfig;

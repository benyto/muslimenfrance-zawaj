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
      layout("components/layout/MessagingWorkspaceLayout.tsx", [
        route("discover", "routes/discover/index.tsx"),
        route("messages", "routes/messages/index.tsx"),
        route("messages/:profileId", "routes/messages/$profileId.tsx"),
      ]),
      route("profile/me", "routes/profile/me.tsx"),
      route("profile/:id", "routes/profile/$id.tsx"),
      route("settings", "routes/settings/index.tsx"),

      layout("lib/auth/RequireAdmin.tsx", [
        route("admin", "components/admin/AdminShell.tsx", [
          index("routes/admin/index.tsx"),
          route("profiles", "routes/admin/profiles.tsx"),
          route("photos", "routes/admin/photos.tsx"),
          route("reports", "routes/admin/reports.tsx"),
          route("subscriptions", "routes/admin/subscriptions.tsx"),
          route("audit-log", "routes/admin/audit-log.tsx"),
        ]),
      ]),
    ]),
  ]),
] satisfies RouteConfig;

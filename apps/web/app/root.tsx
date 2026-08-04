import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Route } from "./+types/root";
import { ThemeProvider, themeInitScript } from "./lib/theme";
import { ToastProvider } from "./components/ui/toast";
import "./app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const meta: Route.MetaFunction = () => [
  { title: "Rencontre — la communauté muslimenfrance" },
  {
    name: "description",
    content:
      "Rencontre accompagne les membres de la communauté muslimenfrance vers une union sérieuse, dans le respect et la confiance.",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline theme script below sets data-theme
    // on <html> before hydration, so the attribute legitimately differs from
    // the pre-rendered markup.
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {/* viewport-fit=cover opts into env(safe-area-inset-*), which the chat
            composer and bottom nav need on notched devices.
            interactive-widget=resizes-content makes the layout viewport shrink
            when the mobile keyboard opens, so a sticky composer stays visible
            instead of being covered. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="theme-color" content="#faf7f2" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0b1f28" media="(prefers-color-scheme: dark)" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Outlet />
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Une erreur est survenue";
  let details = "Réessayez dans un instant — si le problème persiste, contactez-nous.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page introuvable";
      details = "Cette page n'existe pas ou a été déplacée.";
    } else {
      title = `Erreur ${error.status}`;
      details = error.statusText || details;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif text-3xl text-ink">{title}</h1>
      <p className="mt-3 text-sm text-muted">{details}</p>
      <Link
        to="/"
        className="mt-8 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
      >
        Retour à l'accueil
      </Link>
      {stack && (
        <pre className="mt-8 w-full overflow-x-auto rounded-xl bg-sunken p-4 text-left font-mono text-xs text-muted">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

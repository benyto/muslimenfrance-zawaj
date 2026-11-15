import { Link } from "react-router";
import { StarMark } from "~/components/ui/star";
import { legal } from "~/lib/legal-config";
import { cn } from "~/lib/cn";

/**
 * A value from legal-config, or — when it hasn't been filled in yet — a
 * highlighted placeholder, so an unfinished page can't go unnoticed.
 */
export function Fill({ value, label }: { value?: string | null; label: string }) {
  if (value) return <>{value}</>;
  return (
    <mark className="rounded bg-warning-soft px-1 font-medium text-warning">[{label} — à compléter]</mark>
  );
}

export function ContactEmail() {
  return legal.contactEmail ? (
    <a className="text-primary underline underline-offset-2" href={`mailto:${legal.contactEmail}`}>
      {legal.contactEmail}
    </a>
  ) : (
    <Fill label="adresse e-mail de contact" />
  );
}

export const legalLinks = [
  { to: "/cgu", label: "Conditions d’utilisation" },
  { to: "/confidentialite", label: "Politique de confidentialité" },
  { to: "/mentions-legales", label: "Mentions légales" },
] as const;

/** The three legal links, as a wrapped row — for footers and settings. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Informations légales" className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
      {legalLinks.map(({ to, label }) => (
        <Link key={to} to={to} className="text-muted underline-offset-2 hover:text-ink hover:underline">
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Page shell shared by the legal pages: public (no sign-in), readable width. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2 self-start">
        <StarMark className="h-6 w-6 text-accent" />
        <span className="font-serif text-xl text-ink">Rencontre</span>
      </Link>

      <main className="flex-1">
        <h1 className="font-serif text-3xl text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">Dernière mise à jour : {legal.lastUpdated}</p>
        <div className="mt-8">{children}</div>
      </main>

      <footer className="mt-16 border-t border-line pt-6">
        <LegalLinks />
        <p className="mt-3 text-xs text-muted">© {new Date().getFullYear()} Rencontre — une communauté muslimenfrance</p>
      </footer>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-6 text-ink/90">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink/90">{children}</ul>;
}

/** A plain two-column table — purposes and their legal basis, retention periods. */
export function Table({ head, rows }: { head: [string, string, string?]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-sunken text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.filter(Boolean).map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((cells, i) => (
            <tr key={i} className="align-top">
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-3 leading-6 text-ink/90">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { CircleCheck } from "lucide-react";
import { supabase } from "~/lib/supabase-client";
import { useSession } from "~/lib/auth/useSession";
import { safeRedirect } from "~/lib/auth/safe-redirect";
import { StarMark } from "~/components/ui/star";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/form";
import { Card } from "~/components/ui/primitives";

export default function Login() {
  const [searchParams] = useSearchParams();
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const redirect = safeRedirect(searchParams.get("redirect"));
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/verify?redirect=${encodeURIComponent(redirect)}`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  // Already signed in (e.g. a bookmarked /auth/login, or the magic link was
  // just opened in another tab): nothing to do here. Wait for the session
  // lookup first so a signed-in user never sees the form flash.
  if (loading) return null;
  if (session) return <Navigate to={safeRedirect(searchParams.get("redirect"))} replace />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Link to="/" className="mb-8 flex items-center gap-2 self-center">
        <StarMark className="h-6 w-6 text-accent" />
        <span className="font-serif text-xl text-ink">Rencontre</span>
      </Link>

      {status === "sent" ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <CircleCheck className="h-8 w-8 text-success" aria-hidden="true" />
          <h1 className="font-serif text-lg text-ink">Vérifiez votre boîte mail</h1>
          <p className="text-sm text-muted">
            Un lien de connexion a été envoyé à <span className="font-medium text-ink">{email}</span>. Cliquez
            dessus pour vous connecter.
          </p>
        </Card>
      ) : (
        <>
          <h1 className="text-center font-serif text-2xl text-ink">Connexion</h1>
          <p className="mt-2 text-center text-sm text-muted">
            Pas de mot de passe — on vous envoie un lien de connexion par email.
          </p>

          {searchParams.get("error") === "link_expired" && (
            <p role="alert" className="mt-6 rounded-xl bg-warning-soft p-3 text-center text-sm text-warning">
              Ce lien de connexion est invalide ou a expiré. Saisissez votre email pour en recevoir un nouveau.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <Field label="Email" error={status === "error" ? errorMessage ?? undefined : undefined}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="vous@exemple.fr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </Field>
            <Button type="submit" size="lg" loading={status === "sending"}>
              {status === "sending" ? "Envoi..." : "Recevoir le lien de connexion"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

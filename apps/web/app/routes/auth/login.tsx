import { useState } from "react";
import { useSearchParams } from "react-router";
import { supabase } from "~/lib/supabase-client";

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const redirect = searchParams.get("redirect") ?? "/discover";
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <p className="mt-2 text-sm text-muted">
        Pas de mot de passe — on vous envoie un lien de connexion par email.
      </p>

      {status === "sent" ? (
        <p className="mt-8 rounded-2xl bg-primary-soft p-4 text-sm text-primary">
          Vérifiez votre boîte mail ({email}) et cliquez sur le lien pour vous connecter.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            placeholder="vous@exemple.fr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-xl border border-line bg-raised px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-on-primary disabled:opacity-60"
          >
            {status === "sending" ? "Envoi..." : "Recevoir le lien de connexion"}
          </button>
          {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
        </form>
      )}
    </div>
  );
}

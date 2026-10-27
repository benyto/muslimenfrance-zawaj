import { useEffect } from "react";
import { Navigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Hourglass, ShieldAlert } from "lucide-react";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { ButtonLink } from "~/components/ui/button";
import { Card } from "~/components/ui/primitives";

const POLL_MS = 30_000;

// Where RequireApproved sends anyone whose profile isn't approved yet.
export default function Verification() {
  const { data: profile, isPending } = useMyProfile();
  const queryClient = useQueryClient();

  // Approval happens in the admin dashboard, in another session entirely —
  // poll so the page lets them in without a manual reload. (Window focus
  // already refetches, which covers coming back from the approval email.)
  useEffect(() => {
    const id = setInterval(() => queryClient.invalidateQueries({ queryKey: ["my-profile"] }), POLL_MS);
    return () => clearInterval(id);
  }, [queryClient]);

  if (isPending) return null;
  if (!profile) return <Navigate to="/profile/me" replace />;
  if (profile.moderation_status === "approved") return <Navigate to="/discover" replace />;

  const content = {
    pending: {
      icon: Hourglass,
      title: "Votre profil est en cours de vérification",
      body: "Notre équipe examine chaque profil avant de le rendre visible. Vous recevrez un email dès que c'est fait — cette page s'actualise toute seule. En attendant, vous pouvez compléter votre profil et vos photos.",
    },
    rejected: {
      icon: ShieldAlert,
      title: "Votre profil n'a pas été validé",
      body: "Notre équipe n'a pas pu valider votre profil en l'état.",
    },
    disabled: {
      icon: Ban,
      title: "Votre compte est désactivé",
      body: "Votre profil n'est plus visible et l'accès à la communauté est suspendu.",
    },
  }[profile.moderation_status as "pending" | "rejected" | "disabled"];

  if (!content) return <Navigate to="/profile/me" replace />;
  const Icon = content.icon;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-8">
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <Icon className="h-10 w-10 text-accent" aria-hidden="true" />
        <h1 className="font-serif text-2xl text-ink">{content.title}</h1>
        <p className="text-sm text-muted">{content.body}</p>

        {profile.moderation_status === "rejected" && profile.moderation_notes && (
          <div className="w-full rounded-xl bg-sunken p-4 text-left text-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Motif</p>
            <p className="whitespace-pre-wrap break-words text-ink">{profile.moderation_notes}</p>
          </div>
        )}

        {profile.moderation_status !== "disabled" && (
          <ButtonLink to="/profile/me" className="mt-2">
            Modifier mon profil
          </ButtonLink>
        )}
      </Card>
    </div>
  );
}

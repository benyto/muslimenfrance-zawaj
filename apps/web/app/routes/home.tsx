import { MessagesSquare, ShieldCheck, Users } from "lucide-react";
import { StarMark } from "~/components/ui/star";
import { ButtonLink } from "~/components/ui/button";
import { Card } from "~/components/ui/primitives";

const valueProps = [
  {
    icon: ShieldCheck,
    title: "Profils vérifiés",
    description: "Chaque profil est passé en revue par notre équipe avant d'être visible par la communauté.",
  },
  {
    icon: MessagesSquare,
    title: "Messagerie sécurisée",
    description: "Vos échanges restent entre vous — bloquez ou signalez un profil en un instant si besoin.",
  },
  {
    icon: Users,
    title: "Une communauté respectueuse",
    description: "Pensée pour la communauté muslimenfrance et une rencontre sérieuse, dans le respect et la confiance.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center px-6 py-16">
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
        <StarMark className="h-14 w-14 text-accent" />
        <h1 className="mt-4 font-serif text-5xl text-ink">Rencontre</h1>
        <p className="mt-3 max-w-sm text-muted">
          La communauté muslimenfrance, dédiée à la rencontre sérieuse.
        </p>
        <ButtonLink to="/auth/login" size="lg" className="mt-8">
          Se connecter
        </ButtonLink>

        <div className="mt-20 grid w-full gap-4 sm:grid-cols-3">
          {valueProps.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="flex flex-col items-center gap-2 p-6 text-center">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="font-serif text-base text-ink">{title}</h2>
              <p className="text-sm text-muted">{description}</p>
            </Card>
          ))}
        </div>
      </div>

      <p className="mt-16 text-xs text-muted">
        © {new Date().getFullYear()} Rencontre — une communauté muslimenfrance
      </p>
    </div>
  );
}

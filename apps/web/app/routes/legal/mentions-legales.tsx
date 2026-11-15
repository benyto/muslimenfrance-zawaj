import { Link } from "react-router";
import { legal } from "~/lib/legal-config";
import { ContactEmail, Fill, LegalPage, P, Section } from "~/components/legal/legal";

export const meta = () => [{ title: "Mentions légales — Rencontre" }];

export default function LegalNotice() {
  const { publisher, host } = legal;
  return (
    <LegalPage title="Mentions légales">
      <Section title="Éditeur du service">
        <P>
          Rencontre est édité par <Fill value={publisher.name} label="raison sociale" />,{" "}
          <Fill value={publisher.legalForm} label="forme juridique" />
          {publisher.shareCapital ? <>, au capital de {publisher.shareCapital}</> : null}.
        </P>
        <P>
          Siège social : <Fill value={publisher.address} label="adresse du siège" />.
        </P>
        <P>
          Immatriculation : <Fill value={publisher.registration} label="SIREN / RCS (ou RNA)" />
          {publisher.vatNumber ? <> — TVA intracommunautaire : {publisher.vatNumber}</> : null}.
        </P>
        <P>
          Directeur de la publication : <Fill value={publisher.directorOfPublication} label="directeur de la publication" />.
        </P>
        <P>
          Contact : <ContactEmail />.
        </P>
      </Section>

      <Section title="Hébergement">
        <P>
          Le site et l’API sont hébergés par <Fill value={host.name} label="hébergeur" />,{" "}
          <Fill value={host.address} label="adresse de l’hébergeur" />, <Fill value={host.phone} label="téléphone de l’hébergeur" />.
        </P>
        <P>
          Les données (base de données, authentification, photos) sont hébergées par Supabase, dans la région{" "}
          <Fill value={legal.databaseRegion} label="région Supabase" />.
        </P>
      </Section>

      <Section title="Signaler un contenu">
        <P>
          Pour signaler un profil ou un message, utilisez le bouton de signalement du Service : l’équipe de modération
          l’examine. Vous pouvez aussi signaler un contenu manifestement illicite en écrivant à <ContactEmail />, en
          précisant le contenu concerné et le motif.
        </P>
      </Section>

      <Section title="Propriété intellectuelle">
        <P>
          La marque, le logo, le design et les textes du Service appartiennent à l’éditeur. Toute reproduction sans
          autorisation est interdite. Les contenus publiés par les membres restent leur propriété.
        </P>
      </Section>

      <Section title="Données personnelles et conditions d’utilisation">
        <P>
          Le traitement de vos données est décrit dans la{" "}
          <Link to="/confidentialite" className="text-primary underline underline-offset-2">
            politique de confidentialité
          </Link>
          , et l’utilisation du Service dans les{" "}
          <Link to="/cgu" className="text-primary underline underline-offset-2">
            conditions d’utilisation
          </Link>
          .
        </P>
      </Section>
    </LegalPage>
  );
}

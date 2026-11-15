import { Link } from "react-router";
import { legal } from "~/lib/legal-config";
import { ContactEmail, Fill, LegalPage, P, Section, Table, UL } from "~/components/legal/legal";

export const meta = () => [{ title: "Politique de confidentialité — Rencontre" }];

export default function Privacy() {
  return (
    <LegalPage title="Politique de confidentialité">
      <Section title="1. Qui est responsable de vos données">
        <P>
          Le responsable du traitement est <Fill value={legal.publisher.name} label="éditeur" />,{" "}
          <Fill value={legal.publisher.address} label="adresse de l’éditeur" />. Pour toute question sur vos données ou
          pour exercer vos droits : <ContactEmail />.
        </P>
        <P>
          Cette page explique quelles données nous traitons, pourquoi, qui y a accès, combien de temps nous les gardons
          et comment exercer vos droits. Rencontre n’utilise ni publicité, ni outil de mesure d’audience, et ne vend
          aucune donnée.
        </P>
      </Section>

      <Section title="2. Les données que nous traitons">
        <Table
          head={["Catégorie", "Ce que cela comprend"]}
          rows={[
            ["Compte", "Votre adresse e-mail (elle sert à vous connecter et à vous écrire ; elle n’est jamais visible des autres membres)."],
            [
              "Profil",
              "Pseudo, genre, date de naissance (les autres membres ne voient que votre âge), commune, pays d’origine, taille, poids, couleur des yeux et des cheveux, silhouette, niveau d’études, profession, situation professionnelle, tranche de revenus, langues, objectif relationnel, tabac, alcool, enfants, centres d’intérêt, textes de présentation.",
            ],
            [
              "Données sensibles",
              "Religion, niveau de pratique religieuse et origine ethnique, si vous les renseignez (voir l’article 3). Par nature, l’inscription à un service destiné à la communauté muslimenfrance peut aussi révéler vos convictions.",
            ],
            ["Photos", "Les photos que vous ajoutez, leur visibilité (publique ou privée) et les autorisations d’accès que vous accordez."],
            ["Échanges", "Vos messages, vos favoris, les profils que vous ignorez, vos demandes d’accès à des photos privées, vos signalements."],
            ["Présence", "Votre dernière connexion, affichée aux autres uniquement si vous avez activé le statut en ligne."],
            ["Abonnement", "Identifiants client et abonnement Stripe, statut et dates de l’abonnement. Votre carte bancaire est saisie chez Stripe ; nous n’y avons pas accès."],
            ["Modération et sécurité", "Décisions de modération, motifs, signalements, journal des actions de l’équipe, journaux techniques de nos prestataires (dont l’adresse IP)."],
          ]}
        />
        <P>
          La plupart des informations de votre profil, y compris votre tranche de revenus, votre origine ethnique et vos
          informations religieuses si vous les renseignez, sont visibles des membres dont le profil est validé. Ne
          renseignez que ce que vous acceptez de montrer.
        </P>
      </Section>

      <Section title="3. Données sensibles et consentement">
        <P>
          La religion, la pratique religieuse et l’origine ethnique sont des données particulièrement protégées par le
          RGPD (article 9). Nous ne les traitons qu’avec votre consentement explicite, que vous donnez en cochant la case
          prévue dans la section « Confidentialité » de votre profil. Vous pouvez retirer ce consentement à tout moment
          en supprimant votre compte ; le retrait n’affecte pas la légalité de ce qui a été fait avant.
        </P>
      </Section>

      <Section title="4. Pourquoi nous les utilisons">
        <Table
          head={["Finalité", "Base légale"]}
          rows={[
            ["Créer et gérer votre compte, vous connecter, afficher votre profil, permettre la messagerie et la mise en relation", "Exécution du contrat (art. 6.1.b)"],
            ["Traiter vos données sensibles (religion, pratique, origine ethnique)", "Votre consentement explicite (art. 9.2.a)"],
            ["Modérer les profils, photos, textes et messages signalés ; prévenir la fraude et les abus ; sécuriser le Service", "Intérêt légitime (art. 6.1.f) : protéger les membres et le Service"],
            ["Gérer l’abonnement, le paiement et la facturation", "Exécution du contrat ; obligation légale pour la conservation comptable"],
            ["Vous écrire au sujet de votre compte : décisions de modération, abonnement, réponse à vos demandes", "Exécution du contrat"],
            ["Vous prévenir par e-mail d’un nouveau message (activé par défaut, désactivable dans « Réglages »)", "Intérêt légitime : vous éviter de manquer un message"],
            ["Répondre à vos demandes d’exercice de droits et respecter nos obligations légales", "Obligation légale (art. 6.1.c)"],
          ]}
        />
        <P>
          Nous ne prenons aucune décision entièrement automatisée produisant des effets juridiques à votre égard, et nous
          ne vous profilons pas à des fins publicitaires.
        </P>
      </Section>

      <Section title="5. Qui a accès à vos données">
        <UL>
          <li>
            <strong>Les autres membres</strong> (dont le profil est validé) : votre profil et vos photos publiques, et
            vos photos privées uniquement si vous les y avez autorisés.
          </li>
          <li>
            <strong>L’équipe de modération</strong>, habilitée, pour vérifier les profils, photos et textes, et traiter
            les signalements. Dans ce cadre, elle peut consulter les conversations concernées.
          </li>
          <li>
            <strong>Nos prestataires</strong> (sous-traitants), qui n’agissent que sur nos instructions :
          </li>
        </UL>
        <Table
          head={["Prestataire", "Rôle"]}
          rows={[
            ["Supabase", "Base de données, authentification, stockage des photos, messagerie en temps réel"],
            ["Stripe", "Paiement et gestion des abonnements"],
            ["Resend", "Envoi des e-mails (lien de connexion, notifications, messages de service)"],
            [<Fill key="host" value={legal.host.name} label="hébergeur du site et de l’API" />, "Hébergement de l’application"],
          ]}
        />
        <P>
          Nous ne vous demandons jamais de renseigner vos données ailleurs que sur le Service, et nous ne les cédons ni
          ne les louons à des tiers. Elles peuvent être communiquées à une autorité si la loi l’exige.
        </P>
      </Section>

      <Section title="6. Transferts hors de l’Union européenne">
        <P>
          Votre base de données et vos photos sont hébergées dans la région{" "}
          <Fill value={legal.databaseRegion} label="région d’hébergement Supabase" />. Certains prestataires, notamment
          Stripe et Resend, peuvent traiter des données hors de l’Union européenne, notamment aux États-Unis. Ces
          transferts sont encadrés par les garanties prévues par le RGPD (décision d’adéquation, ou clauses contractuelles
          types de la Commission européenne).
        </P>
      </Section>

      <Section title="7. Combien de temps nous les gardons">
        <Table
          head={["Donnée", "Durée"]}
          rows={[
            ["Compte, profil, photos, messages, favoris, autorisations", "Tant que votre compte existe. Supprimés à la suppression du compte (voir ci-dessous)."],
            ["Photos refusées ou supprimées", "Les fichiers sont supprimés de notre stockage au moment de la suppression de la photo ou du compte."],
            ["Comptes inactifs", <Fill key="inactive" label="durée avant suppression d’un compte inactif" />],
            ["Données de paiement et factures", "Conservées par Stripe et par nous pour la durée légale de conservation comptable (10 ans)."],
            ["Notifications techniques de paiement (identifiants d’événements Stripe)", "Supprimées automatiquement après 90 jours."],
            ["Journal des actions de modération", <Fill key="audit" label="durée de conservation du journal de modération" />],
            ["Sauvegardes de notre prestataire", <Fill key="backups" label="durée des sauvegardes" />],
          ]}
        />
        <P>
          <strong>Quand vous supprimez votre compte</strong> (« Réglages » › « Confidentialité et données »), nous
          annulons votre abonnement éventuel, supprimons vos photos de notre stockage, puis effaçons votre profil et vos
          données associées. Vos messages disparaissent des conversations, y compris pour la personne avec qui vous
          échangiez. Vos signalements sont supprimés avec votre compte.
        </P>
      </Section>

      <Section title="8. Vos droits">
        <P>Vous disposez des droits suivants, que vous pouvez exercer gratuitement :</P>
        <UL>
          <li>
            <strong>accès et portabilité</strong> : « Réglages » › « Exporter mes données » vous remet l’ensemble de vos
            données dans un fichier ;
          </li>
          <li>
            <strong>rectification</strong> : vous modifiez vous-même votre profil ;
          </li>
          <li>
            <strong>effacement</strong> : « Réglages » › « Supprimer mon compte » ;
          </li>
          <li>
            <strong>opposition et limitation</strong>, notamment pour les traitements fondés sur l’intérêt légitime ;
          </li>
          <li>
            <strong>retrait du consentement</strong> pour les données sensibles (voir l’article 3) ;
          </li>
          <li>
            <strong>directives après décès</strong> : vous pouvez nous indiquer ce que vos données doivent devenir.
          </li>
        </UL>
        <P>
          Pour les droits qui ne sont pas disponibles en libre-service, écrivez à <ContactEmail />. Nous répondons dans
          un délai d’un mois. Nous pouvons vous demander de confirmer votre identité.
        </P>
        <P>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la{" "}
          <a
            className="text-primary underline underline-offset-2"
            href="https://www.cnil.fr/fr/plaintes"
            target="_blank"
            rel="noreferrer"
          >
            CNIL
          </a>{" "}
          (Commission nationale de l’informatique et des libertés).
        </P>
      </Section>

      <Section title="9. Comment nous protégeons vos données">
        <UL>
          <li>La connexion se fait par lien envoyé par e-mail : il n’existe aucun mot de passe à voler.</li>
          <li>Les échanges avec le Service sont chiffrés (HTTPS).</li>
          <li>
            Chaque membre n’accède qu’à ses propres données et à ce que le Service lui montre ; les règles d’accès sont
            appliquées par la base de données elle-même.
          </li>
          <li>
            Les photos sont stockées dans un espace privé et ne s’affichent que par des liens temporaires, délivrés
            uniquement aux membres autorisés.
          </li>
          <li>Les actions de l’équipe de modération sont journalisées.</li>
        </UL>
      </Section>

      <Section title="10. Cookies et traceurs">
        <P>
          Rencontre ne dépose aucun cookie publicitaire ni de mesure d’audience. Le navigateur conserve uniquement ce qui
          est nécessaire au fonctionnement : votre session de connexion et votre préférence d’affichage (clair ou
          sombre). Ces éléments sont indispensables au Service, c’est pourquoi aucun bandeau de consentement n’est
          nécessaire.
        </P>
      </Section>

      <Section title="11. Mineurs">
        <P>
          Le Service est réservé aux personnes majeures. Si nous constatons qu’un compte appartient à un mineur, nous le
          supprimons. Si vous pensez qu’un mineur utilise le Service, signalez-le nous.
        </P>
      </Section>

      <Section title="12. Modifications">
        <P>
          Nous pouvons mettre à jour cette politique, par exemple si nous changeons de prestataire. La date de dernière
          mise à jour figure en haut de la page ; en cas de changement important, nous vous en informons. Voir aussi les{" "}
          <Link to="/cgu" className="text-primary underline underline-offset-2">
            conditions d’utilisation
          </Link>
          .
        </P>
      </Section>
    </LegalPage>
  );
}

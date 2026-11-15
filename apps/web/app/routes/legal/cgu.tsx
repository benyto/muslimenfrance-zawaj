import { Link } from "react-router";
import { legal } from "~/lib/legal-config";
import { ContactEmail, Fill, LegalPage, P, Section, UL } from "~/components/legal/legal";

export const meta = () => [{ title: "Conditions d’utilisation — Rencontre" }];

export default function Terms() {
  return (
    <LegalPage title="Conditions générales d’utilisation">
      <Section title="1. Objet">
        <P>
          Les présentes conditions régissent l’utilisation de Rencontre (« le Service »), un service de rencontre
          destiné à la communauté muslimenfrance et édité par <Fill value={legal.publisher.name} label="éditeur" />.
          L’éditeur est identifié dans les{" "}
          <Link to="/mentions-legales" className="text-primary underline underline-offset-2">
            mentions légales
          </Link>
          .
        </P>
        <P>
          En vous connectant au Service, vous déclarez avoir lu et accepté ces conditions ainsi que la{" "}
          <Link to="/confidentialite" className="text-primary underline underline-offset-2">
            politique de confidentialité
          </Link>
          . Si vous ne les acceptez pas, n’utilisez pas le Service.
        </P>
      </Section>

      <Section title="2. Qui peut utiliser le Service">
        <UL>
          <li>Vous devez être une personne physique et avoir au moins 18 ans.</li>
          <li>Vous ne pouvez avoir qu’un seul compte, pour vous-même.</li>
          <li>
            Les informations que vous donnez (pseudo, date de naissance, genre, photos…) doivent être exactes et vous
            concerner. Les faux profils et l’usurpation d’identité sont interdits.
          </li>
          <li>
            Le Service est destiné à une recherche sérieuse de relation. Il n’est pas destiné à un usage commercial
            ou promotionnel.
          </li>
        </UL>
      </Section>

      <Section title="3. Compte et connexion">
        <P>
          Il n’y a pas de mot de passe : vous vous connectez grâce à un lien envoyé à votre adresse e-mail. Vous
          devez donc garder l’accès à cette boîte mail personnel et ne pas transmettre ce lien. Vous êtes responsable
          de l’usage fait de votre compte depuis votre adresse e-mail.
        </P>
      </Section>

      <Section title="4. Validation des profils, des photos et des modifications">
        <P>Pour préserver la qualité et la sécurité de la communauté, l’équipe de modération vérifie :</P>
        <UL>
          <li>
            <strong>votre profil</strong>, qui n’est visible des autres membres qu’après validation ;
          </li>
          <li>
            <strong>chacune de vos photos</strong>, qui n’est visible des autres qu’après validation ;
          </li>
          <li>
            <strong>les modifications de vos textes de présentation</strong> (« Parlez de vous » et « Ce que vous
            recherchez ») : tant qu’une modification n’est pas validée, votre version précédente reste affichée.
          </li>
        </UL>
        <P>
          L’équipe peut refuser un contenu, vous demander de le modifier, ou suspendre un profil qui ne respecte pas
          ces conditions. Un refus ne donne lieu à aucun droit à indemnité, mais vous pouvez demander des
          explications en nous écrivant (voir « Contact »).
        </P>
      </Section>

      <Section title="5. Règles de conduite">
        <P>Vous vous engagez à respecter les autres membres. Sont notamment interdits :</P>
        <UL>
          <li>le harcèlement, les menaces, les insultes, les propos discriminatoires, haineux ou violents ;</li>
          <li>les contenus sexuellement explicites, la nudité, les contenus choquants ou illégaux ;</li>
          <li>
            les photos ou informations concernant une autre personne sans son accord, et toute photo de mineur ;
          </li>
          <li>
            les arnaques, demandes d’argent, démarchages commerciaux, publicités, messages répétitifs non sollicités ;
          </li>
          <li>
            la diffusion à des tiers du contenu d’un autre membre (photos, messages, informations de profil) sans son
            accord ;
          </li>
          <li>toute tentative de contourner les mesures de sécurité ou de modération du Service.</li>
        </UL>
      </Section>

      <Section title="6. Vos contenus et vos photos">
        <P>
          Vous restez propriétaire de ce que vous publiez. Vous nous autorisez à l’héberger et à l’afficher aux autres
          membres dans le cadre du Service, dans les limites des réglages que vous choisissez, pour la durée de votre
          inscription. Vous garantissez détenir les droits sur vos photos et sur vos textes.
        </P>
        <P>
          Chaque photo est publique (visible des membres dont le profil est validé) ou privée (visible uniquement des
          membres que vous avez autorisés). Vous pouvez retirer une autorisation à tout moment. Nous ne pouvons toutefois
          pas empêcher un membre autorisé d’en faire une capture d’écran : n’autorisez que des personnes de confiance.
        </P>
      </Section>

      <Section title="7. Messagerie, signalement et profils ignorés">
        <P>
          Vous pouvez échanger des messages avec les membres dont le profil est validé. Vous pouvez signaler un profil
          ou un message depuis le Service ; l’équipe examine les signalements et peut prendre les mesures décrites à
          l’article 8. Vous pouvez aussi ignorer un profil : ses messages n’apparaissent plus dans votre boîte de
          réception et il n’en est pas informé.
        </P>
        <P>
          Dans le cadre du traitement d’un signalement ou pour assurer la sécurité du Service, les membres habilités de
          l’équipe de modération peuvent consulter les conversations concernées.
        </P>
      </Section>

      <Section title="8. Sanctions">
        <P>
          En cas de non-respect de ces conditions, nous pouvons, selon la gravité, supprimer un contenu, avertir un
          membre, suspendre temporairement ou désactiver son compte, ou le supprimer définitivement, sans préavis en
          cas de manquement grave. Vous pouvez contester une décision en nous écrivant.
        </P>
      </Section>

      <Section title="9. Abonnement et paiement">
        <P>
          Certaines fonctionnalités, notamment l’envoi de messages, peuvent être réservées aux abonnés. Lorsqu’un
          abonnement est proposé :
        </P>
        <UL>
          <li>le prix, toutes taxes comprises, la durée d’une éventuelle période d’essai et la périodicité sont affichés
            avant toute souscription ;</li>
          <li>
            le paiement est traité par notre prestataire Stripe ; nous ne voyons ni ne conservons vos coordonnées
            bancaires ;
          </li>
          <li>
            l’abonnement se renouvelle automatiquement à chaque période, sauf résiliation de votre part, que vous pouvez
            effectuer à tout moment depuis « Réglages » ; elle prend effet à la fin de la période en cours ;
          </li>
          <li>
            en cas d’échec de paiement, l’accès aux fonctionnalités réservées aux abonnés peut être suspendu.
          </li>
        </UL>
        <P>
          <strong>Droit de rétractation.</strong> Si vous êtes consommateur, vous disposez de 14 jours à compter de la
          souscription pour vous rétracter, sans avoir à vous justifier. Avant de payer, il vous est demandé de
          cocher deux cases distinctes : l’acceptation de ces conditions, et votre demande expresse que l’abonnement
          commence immédiatement, avant la fin de ce délai. Dans ce cas, si vous vous rétractez, vous paierez un
          montant proportionnel au service déjà fourni jusqu’à votre demande. Si vous ne cochez pas ces cases, vous
          ne pouvez pas souscrire. Pour vous rétracter, écrivez-nous (voir « Contact »). Nous conservons la preuve de
          votre accord (date, version des textes affichés).
        </P>
      </Section>

      <Section title="10. Sécurité et rencontres">
        <P>
          Nous passons en revue les profils, mais nous ne pouvons pas vérifier l’identité ni les intentions de chaque
          membre. Quelques précautions utiles :
        </P>
        <UL>
          <li>donnez un premier rendez-vous dans un lieu public et prévenez un proche ;</li>
          <li>ne communiquez pas d’informations bancaires et n’envoyez jamais d’argent à une personne rencontrée ici ;</li>
          <li>méfiez-vous de quiconque vous presse de quitter le Service ou refuse toute vérification ;</li>
          <li>signalez tout comportement suspect.</li>
        </UL>
        <P>Les rencontres entre membres se font sous leur seule responsabilité.</P>
      </Section>

      <Section title="11. Responsabilité">
        <P>
          Nous mettons en œuvre les moyens raisonnables pour assurer le fonctionnement du Service, sans garantir qu’il
          sera accessible sans interruption ni erreur. Les contenus publiés par les membres sont publiés sous leur
          responsabilité ; en tant qu’hébergeur, nous retirons promptement tout contenu manifestement illicite qui nous
          est signalé. Nous ne garantissons aucun résultat quant à la rencontre d’une personne. Rien dans ces
          conditions n’exclut la responsabilité qui ne peut l’être en vertu de la loi.
        </P>
      </Section>

      <Section title="12. Propriété intellectuelle">
        <P>
          Le Service (marque, logo, design, textes, code) appartient à l’éditeur ou à ses concédants. Il ne peut être
          copié ni réutilisé sans autorisation.
        </P>
      </Section>

      <Section title="13. Données personnelles">
        <P>
          Le traitement de vos données, y compris les données sensibles que vous choisissez de renseigner (religion,
          pratique religieuse, origine ethnique), est décrit dans la{" "}
          <Link to="/confidentialite" className="text-primary underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </P>
      </Section>

      <Section title="14. Fin de l’utilisation">
        <P>
          Vous pouvez supprimer votre compte à tout moment depuis « Réglages » ; vos données sont alors effacées comme
          indiqué dans la politique de confidentialité. Nous pouvons mettre fin au Service ou à un compte dans les
          conditions de l’article 8.
        </P>
      </Section>

      <Section title="15. Modification des conditions">
        <P>
          Nous pouvons modifier ces conditions, par exemple pour tenir compte d’une évolution du Service ou de la loi.
          Les modifications importantes vous sont signalées avant leur entrée en vigueur ; continuer à utiliser le
          Service après cette date vaut acceptation. La date de dernière mise à jour figure en haut de cette page.
        </P>
      </Section>

      <Section title="16. Droit applicable et litiges">
        <P>
          Ces conditions sont soumises au droit français. En cas de difficulté, contactez-nous d’abord : nous
          chercherons une solution amiable.
        </P>
        <P>
          Si vous êtes consommateur, vous pouvez recourir gratuitement à un médiateur de la consommation :{" "}
          <Fill value={legal.mediator.name} label="médiateur de la consommation" />
          {legal.mediator.website ? (
            <>
              {" "}
              (
              <a className="text-primary underline underline-offset-2" href={legal.mediator.website}>
                {legal.mediator.website}
              </a>
              )
            </>
          ) : (
            <>
              {" "}
              (<Fill label="site du médiateur" />)
            </>
          )}
          . À défaut d’accord, les tribunaux compétents sont ceux déterminés par les règles de droit commun, et vous
          pouvez saisir la juridiction de votre lieu de résidence.
        </P>
      </Section>

      <Section title="17. Contact">
        <P>
          Pour toute question, demande ou signalement : <ContactEmail />.
        </P>
      </Section>
    </LegalPage>
  );
}

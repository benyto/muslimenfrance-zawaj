import { env } from "../../env.js";
import { emailLayout } from "./layout.js";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function newMessageEmail(params: { recipientNickname: string; senderNickname: string; preview: string }) {
  return {
    subject: `${params.senderNickname} vous a envoyé un message`,
    html: emailLayout(
      `Nouveau message de ${params.senderNickname}`,
      `<p>Bonjour ${params.recipientNickname},</p>
       <p><strong>${params.senderNickname}</strong> vous a envoyé un message : « ${params.preview} »</p>`,
      `${env.SITE_URL}/messages`,
      "Répondre"
    ),
  };
}

export function subscriptionStartedEmail(params: { nickname: string; trialEnd: string | null }) {
  const trialHtml = params.trialEnd
    ? `<p>Votre période d'essai gratuite se termine le <strong>${formatDate(params.trialEnd)}</strong>.</p>`
    : "";
  return {
    subject: "Bienvenue dans votre abonnement Rencontre",
    html: emailLayout(
      "Abonnement activé",
      `<p>Bonjour ${params.nickname},</p>
       <p>Votre abonnement Rencontre est actif — vous pouvez désormais échanger librement avec les autres membres.</p>
       ${trialHtml}`,
      `${env.SITE_URL}/discover`,
      "Découvrir des profils"
    ),
  };
}

export function trialEndingSoonEmail(params: { nickname: string; trialEnd: string }) {
  return {
    subject: "Votre période d'essai se termine bientôt",
    html: emailLayout(
      "Votre essai gratuit se termine bientôt",
      `<p>Bonjour ${params.nickname},</p>
       <p>Votre période d'essai gratuite se termine le <strong>${formatDate(params.trialEnd)}</strong>. Votre abonnement sera ensuite facturé automatiquement, sauf annulation.</p>`,
      `${env.SITE_URL}/settings`,
      "Gérer mon abonnement"
    ),
  };
}

export function paymentFailedEmail(params: { nickname: string }) {
  return {
    subject: "Échec de paiement — action requise",
    html: emailLayout(
      "Échec de paiement",
      `<p>Bonjour ${params.nickname},</p>
       <p>Le paiement de votre abonnement Rencontre a échoué. Merci de mettre à jour votre moyen de paiement pour continuer à profiter de votre abonnement.</p>`,
      `${env.SITE_URL}/settings`,
      "Mettre à jour mon paiement"
    ),
  };
}

export function subscriptionCanceledEmail(params: { nickname: string }) {
  return {
    subject: "Votre abonnement a été annulé",
    html: emailLayout(
      "Abonnement annulé",
      `<p>Bonjour ${params.nickname},</p>
       <p>Votre abonnement Rencontre a été annulé. Vous pouvez vous réabonner à tout moment.</p>`,
      `${env.SITE_URL}/settings`,
      "Se réabonner"
    ),
  };
}

export function reportReceivedEmail(params: { nickname: string }) {
  return {
    subject: "Votre signalement a bien été reçu",
    html: emailLayout(
      "Signalement reçu",
      `<p>Bonjour ${params.nickname},</p>
       <p>Nous avons bien reçu votre signalement. Notre équipe de modération va l'examiner dans les plus brefs délais.</p>`
    ),
  };
}

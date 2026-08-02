import { useState } from "react";
import {
  useAdminSubscriptionProducts,
  useCreateSubscriptionProduct,
  useUpdateSubscriptionProduct,
  type AdminSubscriptionProductRow,
} from "~/lib/queries/useAdmin";

const audienceLabels: Record<string, string> = { all: "Tous", male: "Hommes", female: "Femmes" };

export default function AdminSubscriptions() {
  const { data: products, isLoading } = useAdminSubscriptionProducts();

  return (
    <div>
      <div className="rounded-2xl border border-brand-rose-200 bg-brand-rose-50 p-4 text-sm text-brand-rose-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-brand-rose-300">
        Tant qu'aucun produit n'est activé (« Actif » désactivé) pour l'audience d'un utilisateur, la
        messagerie reste gratuite pour lui — c'est le mode de lancement actuel.
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}
        {products?.map((product) => <ProductRow key={product.id} product={product} />)}
      </div>

      <CreateProductForm existingAudiences={products?.map((p) => p.audience) ?? []} />
    </div>
  );
}

function ProductRow({ product }: { product: AdminSubscriptionProductRow }) {
  const [name, setName] = useState(product.name);
  const [priceAmount, setPriceAmount] = useState(product.price_amount?.toString() ?? "");
  const [trialDays, setTrialDays] = useState(product.trial_period_days.toString());
  const update = useUpdateSubscriptionProduct();

  function save() {
    update.mutate({
      id: product.id,
      name,
      priceAmount: priceAmount === "" ? null : Number(priceAmount),
      trialPeriodDays: Number(trialDays),
    });
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {audienceLabels[product.audience] ?? product.audience}
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={product.enabled}
            onChange={(e) => update.mutate({ id: product.id, enabled: e.target.checked })}
          />
          Actif
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs text-neutral-500">Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Prix (centimes)</label>
          <input
            type="number"
            value={priceAmount}
            onChange={(e) => setPriceAmount(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Essai (jours)</label>
          <input
            type="number"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={save}
            disabled={update.isPending}
            className="w-full rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Enregistrer
          </button>
        </div>
      </div>

      {product.stripe_price_id && (
        <p className="mt-2 text-xs text-neutral-400">Stripe price: {product.stripe_price_id}</p>
      )}
      {update.isError && <p className="mt-2 text-sm text-red-600">{(update.error as Error).message}</p>}
    </div>
  );
}

function CreateProductForm({ existingAudiences }: { existingAudiences: string[] }) {
  const [audience, setAudience] = useState<"all" | "male" | "female">("all");
  const [name, setName] = useState("");
  const [trialDays, setTrialDays] = useState("7");
  const create = useCreateSubscriptionProduct();

  const availableAudiences = (["all", "male", "female"] as const).filter(
    (a) => !existingAudiences.includes(a)
  );

  if (availableAudiences.length === 0) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name) return;
    create.mutate(
      { audience, name, trialPeriodDays: Number(trialDays), enabled: false },
      { onSuccess: () => setName("") }
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex flex-col gap-2 rounded-2xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700"
    >
      <p className="text-sm font-medium">Nouveau produit d'abonnement</p>
      <div className="flex flex-wrap gap-2">
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as typeof audience)}
          className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
        >
          {availableAudiences.map((a) => (
            <option key={a} value={a}>
              {audienceLabels[a]}
            </option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (ex: Abonnement Premium)"
          required
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
        />
        <input
          type="number"
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
          placeholder="Essai (jours)"
          className="w-28 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-xl bg-brand-rose-500 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          Créer
        </button>
      </div>
      {create.isError && <p className="text-sm text-red-600">{(create.error as Error).message}</p>}
    </form>
  );
}

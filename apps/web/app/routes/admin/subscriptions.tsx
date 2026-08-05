import { useState } from "react";
import {
  useAdminSubscriptionProducts,
  useCreateSubscriptionProduct,
  useUpdateSubscriptionProduct,
  type AdminSubscriptionProductRow,
} from "~/lib/queries/useAdmin";
import { Badge, Card, Skeleton } from "~/components/ui/primitives";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Checkbox } from "~/components/ui/form";

const audienceLabels: Record<string, string> = { all: "Tous", male: "Hommes", female: "Femmes" };

export default function AdminSubscriptions() {
  const { data: products, isLoading } = useAdminSubscriptionProducts();

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink">Abonnements</h1>

      <Card className="mt-4 border-primary/30 bg-primary-soft p-4">
        <p className="text-sm text-primary">
          Tant qu&apos;aucun produit n&apos;est activé (« Actif » désactivé) pour l&apos;audience d&apos;un
          utilisateur, la messagerie reste gratuite pour lui — c&apos;est le mode de lancement actuel.
        </p>
      </Card>

      <div className="mt-4 flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
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
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <Badge tone="neutral">{audienceLabels[product.audience] ?? product.audience}</Badge>
        <Checkbox
          label="Actif"
          checked={product.enabled}
          onChange={(e) => update.mutate({ id: product.id, enabled: e.target.checked })}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Nom">
          {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Prix (centimes)">
          {(props) => (
            <Input {...props} type="number" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} />
          )}
        </Field>
        <Field label="Essai (jours)">
          {(props) => (
            <Input {...props} type="number" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
          )}
        </Field>
        <div className="flex items-end">
          <Button className="w-full" loading={update.isPending} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </div>

      {product.stripe_price_id && (
        <p className="mt-2 text-xs text-muted">Stripe price: {product.stripe_price_id}</p>
      )}
      {update.isError && <p className="mt-2 text-sm text-danger">{(update.error as Error).message}</p>}
    </Card>
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
    <Card className="mt-4 border-dashed p-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm font-medium text-ink">Nouveau produit d&apos;abonnement</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Audience">
            {(props) => (
              <Select {...props} value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
                {availableAudiences.map((a) => (
                  <option key={a} value={a}>
                    {audienceLabels[a]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nom" full>
            {(props) => (
              <Input {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Abonnement Premium" required />
            )}
          </Field>
          <Field label="Essai (jours)">
            {(props) => <Input {...props} type="number" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />}
          </Field>
        </div>
        <Button type="submit" className="self-start" loading={create.isPending}>
          Créer
        </Button>
        {create.isError && <p className="text-sm text-danger">{(create.error as Error).message}</p>}
      </form>
    </Card>
  );
}

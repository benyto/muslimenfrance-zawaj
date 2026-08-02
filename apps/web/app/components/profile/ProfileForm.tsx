import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileInputSchema,
  type ProfileInput,
  genderOptions,
  genderLabels,
  eyeColorOptions,
  eyeColorLabels,
  hairColorOptions,
  hairColorLabels,
  bodyTypeOptions,
  bodyTypeLabels,
  educationLevelOptions,
  educationLevelLabels,
  employmentStatusOptions,
  employmentStatusLabels,
  religionOptions,
  religionLabels,
  religiosityLevelOptions,
  religiosityLevelLabels,
  relationshipGoalOptions,
  relationshipGoalLabels,
  smokerOptions,
  smokerLabels,
  drinkerOptions,
  drinkerLabels,
  wantsChildrenOptions,
  wantsChildrenLabels,
} from "@rencontre/shared";
import { useMyProfile } from "~/lib/queries/useMyProfile";
import { useUpsertProfile } from "~/lib/queries/useUpsertProfile";
import { TagInput } from "./TagInput";
import { CommuneAutocomplete } from "./CommuneAutocomplete";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
  full,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-rose-500 dark:border-neutral-800 dark:bg-neutral-900";

function optionEntries(options: readonly string[], labels: Record<string, string>) {
  return options.map((value) => ({ value, label: labels[value] ?? value }));
}

export function ProfileForm() {
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const upsert = useUpsertProfile();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: {
      nickname: "",
      interests: [],
      languagesSpoken: [],
      specialCategoryConsent: false,
    } as unknown as ProfileInput,
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      nickname: profile.nickname ?? "",
      gender: (profile.gender as ProfileInput["gender"]) ?? undefined,
      birthdate: profile.birthdate ?? "",
      interests: profile.interests ?? [],
      height: profile.height ?? undefined,
      weight: profile.weight ?? undefined,
      eyeColor: profile.eye_color ?? undefined,
      hairColor: profile.hair_color ?? undefined,
      bodyType: profile.body_type ?? undefined,
      educationLevel: profile.education_level ?? undefined,
      occupation: profile.occupation ?? undefined,
      employmentStatus: profile.employment_status ?? undefined,
      incomeRange: profile.income_range ?? undefined,
      ethnicity: profile.ethnicity ?? undefined,
      religion: profile.religion ?? undefined,
      religiosityLevel: profile.religiosity_level ?? undefined,
      languagesSpoken: profile.languages_spoken ?? [],
      relationshipGoal: profile.relationship_goal ?? undefined,
      smoker: profile.smoker ?? undefined,
      drinker: profile.drinker ?? undefined,
      hasChildren: profile.has_children ?? undefined,
      wantsChildren: profile.wants_children ?? undefined,
      communeInseeCode: profile.commune_insee_code ?? undefined,
      specialCategoryConsent: (profile.special_category_consent ?? false) as ProfileInput["specialCategoryConsent"],
    } as unknown as ProfileInput);
  }, [profile, reset]);

  function onSubmit(values: ProfileInput) {
    upsert.mutate({ input: values, isFirstConsent: !profile?.special_category_consent });
  }

  if (profileLoading) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Section title="Informations de base">
        <Field label="Prénom / pseudo" error={errors.nickname?.message}>
          <input type="text" {...register("nickname")} className={inputClass} />
        </Field>
        <Field label="Genre" error={errors.gender?.message}>
          <select {...register("gender")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(genderOptions, genderLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date de naissance" error={errors.birthdate?.message}>
          <input type="date" {...register("birthdate")} className={inputClass} />
        </Field>
        <Field label="Ville" error={errors.communeInseeCode?.message}>
          <Controller
            name="communeInseeCode"
            control={control}
            render={({ field }) => (
              <CommuneAutocomplete value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>
      </Section>

      <Section title="Physique">
        <Field label="Taille (cm)" error={errors.height?.message}>
          <input
            type="number"
            {...register("height", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            className={inputClass}
            min={100}
            max={250}
          />
        </Field>
        <Field label="Poids (kg)" error={errors.weight?.message}>
          <input
            type="number"
            {...register("weight", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            className={inputClass}
            min={30}
            max={300}
          />
        </Field>
        <Field label="Couleur des yeux">
          <select {...register("eyeColor")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(eyeColorOptions, eyeColorLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Couleur des cheveux">
          <select {...register("hairColor")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(hairColorOptions, hairColorLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type de corps">
          <select {...register("bodyType")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(bodyTypeOptions, bodyTypeLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Informations socio-professionnelles">
        <Field label="Niveau d'éducation">
          <select {...register("educationLevel")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(educationLevelOptions, educationLevelLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Profession">
          <input type="text" {...register("occupation")} className={inputClass} maxLength={100} />
        </Field>
        <Field label="Statut professionnel">
          <select {...register("employmentStatus")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(employmentStatusOptions, employmentStatusLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tranche de revenus">
          <input type="text" {...register("incomeRange")} className={inputClass} placeholder="ex: 2000-4000€" maxLength={30} />
        </Field>
      </Section>

      <Section title="Origines et culture">
        <Field label="Ethnie">
          <input type="text" {...register("ethnicity")} className={inputClass} placeholder="ex: Nord-Africain, Européen..." maxLength={50} />
        </Field>
        <Field label="Religion">
          <select {...register("religion")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(religionOptions, religionLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Niveau de pratique">
          <select {...register("religiosityLevel")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(religiosityLevelOptions, religiosityLevelLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Langues parlées" full>
          <Controller
            name="languagesSpoken"
            control={control}
            render={({ field }) => (
              <TagInput label="" placeholder="Ajouter une langue" value={field.value ?? []} onChange={field.onChange} max={10} />
            )}
          />
        </Field>
      </Section>

      <Section title="Préférences relationnelles">
        <Field label="Objectif relationnel">
          <select {...register("relationshipGoal")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(relationshipGoalOptions, relationshipGoalLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fumeur">
          <select {...register("smoker")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(smokerOptions, smokerLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Consommation d'alcool">
          <select {...register("drinker")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(drinkerOptions, drinkerLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Souhaite des enfants">
          <select {...register("wantsChildren")} className={inputClass}>
            <option value="">Sélectionner</option>
            {optionEntries(wantsChildrenOptions, wantsChildrenLabels).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Enfants" full>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("hasChildren")} className="h-4 w-4" />
            J&apos;ai des enfants
          </label>
        </Field>
      </Section>

      <Section title="Centres d'intérêt">
        <Field label="" full>
          <Controller
            name="interests"
            control={control}
            render={({ field }) => (
              <TagInput label="Centres d'intérêt" placeholder="ex: Lecture, Voyage..." value={field.value ?? []} onChange={field.onChange} max={20} />
            )}
          />
        </Field>
      </Section>

      <Section title="Confidentialité">
        <Field label="" full error={errors.specialCategoryConsent?.message}>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" {...register("specialCategoryConsent")} className="mt-1 h-4 w-4" />
            <span>
              J&apos;accepte que mes données relatives à ma religion et mon niveau de pratique religieuse soient
              collectées et utilisées dans le cadre de mon profil de rencontre (données sensibles au sens du RGPD).
            </span>
          </label>
        </Field>
      </Section>

      {upsert.isError && (
        <p className="text-sm text-red-600">{(upsert.error as Error).message}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || upsert.isPending}
        className="self-start rounded-xl bg-gradient-to-r from-brand-rose-500 to-brand-purple-500 px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {upsert.isPending ? "Enregistrement..." : "Enregistrer mon profil"}
      </button>
    </form>
  );
}

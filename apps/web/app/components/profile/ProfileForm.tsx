import { useEffect } from "react";
import { useBlocker } from "react-router";
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
import { CountryAutocomplete } from "./CountryAutocomplete";
import { useToast } from "~/components/ui/toast";
import { StarSpinner } from "~/components/ui/star";
import { ProgressBar } from "~/components/ui/primitives";
import { Field, Input, Select, Textarea, Checkbox } from "~/components/ui/form";
import { ConfirmDialog } from "~/components/ui/sheet";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-raised p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function optionEntries(options: readonly string[], labels: Record<string, string>) {
  return options.map((value) => ({ value, label: labels[value] ?? value }));
}

export function ProfileForm({ completion }: { completion: number }) {
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const upsert = useUpsertProfile();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
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
      bio: profile.bio ?? "",
      lookingFor: profile.looking_for ?? "",
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
      originCountryCode: profile.origin_country_code ?? undefined,
      specialCategoryConsent: (profile.special_category_consent ?? false) as ProfileInput["specialCategoryConsent"],
    } as unknown as ProfileInput);
  }, [profile, reset]);

  function onSubmit(values: ProfileInput) {
    upsert.mutate(
      { input: values, isFirstConsent: !profile?.special_category_consent },
      {
        // No manual reset needed here — a successful save invalidates the
        // my-profile query, which reruns the effect above with fresh values
        // and clears isDirty as a side effect of that reset() call.
        onSuccess: () => toast({ tone: "success", title: "Profil enregistré" }),
        onError: (error) =>
          toast({ tone: "error", title: "Échec de l'enregistrement", description: (error as Error).message }),
      }
    );
  }

  // In-app navigation (clicking Découvrir, Messages, etc.) — covered by
  // React Router's blocker. Leaving the app entirely (closing the tab,
  // refreshing, typing a new URL) isn't something the router can see, so
  // that's the separate native beforeunload prompt below; the browser
  // supplies its own wording for that one, a custom dialog isn't possible.
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  if (profileLoading) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pb-28">
      <Section title="Informations de base">
        <Field label="Prénom / pseudo" required error={errors.nickname?.message}>
          {(props) => <Input {...props} type="text" {...register("nickname")} />}
        </Field>
        <Field label="Genre" required error={errors.gender?.message}>
          {(props) => (
            <Select {...props} {...register("gender")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(genderOptions, genderLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date de naissance" required error={errors.birthdate?.message}>
          {(props) => <Input {...props} type="date" {...register("birthdate")} />}
        </Field>
        <Field label="Ville" error={errors.communeInseeCode?.message}>
          {() => (
            <Controller
              name="communeInseeCode"
              control={control}
              render={({ field }) => (
                <CommuneAutocomplete value={field.value} onChange={field.onChange} />
              )}
            />
          )}
        </Field>
      </Section>

      <Section title="À propos de moi">
        <Field label="Parlez de vous" error={errors.bio?.message} full>
          {(props) => (
            <Textarea
              {...props}
              {...register("bio")}
              rows={4}
              maxLength={1000}
              placeholder="Ce qui vous décrit le mieux, vos valeurs, votre quotidien..."
            />
          )}
        </Field>
        <Field label="Ce que vous recherchez" error={errors.lookingFor?.message} full>
          {(props) => (
            <Textarea
              {...props}
              {...register("lookingFor")}
              rows={4}
              maxLength={1000}
              placeholder="La personne et la relation que vous recherchez..."
            />
          )}
        </Field>
      </Section>

      <Section title="Physique">
        <Field label="Taille (cm)" error={errors.height?.message}>
          {(props) => (
            <Input
              {...props}
              type="number"
              {...register("height", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              min={100}
              max={250}
            />
          )}
        </Field>
        <Field label="Poids (kg)" error={errors.weight?.message}>
          {(props) => (
            <Input
              {...props}
              type="number"
              {...register("weight", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              min={30}
              max={300}
            />
          )}
        </Field>
        <Field label="Couleur des yeux" error={errors.eyeColor?.message}>
          {(props) => (
            <Select {...props} {...register("eyeColor")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(eyeColorOptions, eyeColorLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Couleur des cheveux" error={errors.hairColor?.message}>
          {(props) => (
            <Select {...props} {...register("hairColor")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(hairColorOptions, hairColorLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Type de corps" error={errors.bodyType?.message}>
          {(props) => (
            <Select {...props} {...register("bodyType")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(bodyTypeOptions, bodyTypeLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Section>

      <Section title="Informations socio-professionnelles">
        <Field label="Niveau d'éducation" error={errors.educationLevel?.message}>
          {(props) => (
            <Select {...props} {...register("educationLevel")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(educationLevelOptions, educationLevelLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Profession" error={errors.occupation?.message}>
          {(props) => <Input {...props} type="text" {...register("occupation")} maxLength={100} />}
        </Field>
        <Field label="Statut professionnel" error={errors.employmentStatus?.message}>
          {(props) => (
            <Select {...props} {...register("employmentStatus")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(employmentStatusOptions, employmentStatusLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tranche de revenus" error={errors.incomeRange?.message}>
          {(props) => (
            <Input {...props} type="text" {...register("incomeRange")} placeholder="ex: 2000-4000€" maxLength={30} />
          )}
        </Field>
      </Section>

      <Section title="Origines et culture">
        <Field label="Pays d'origine" error={errors.originCountryCode?.message}>
          {() => (
            <Controller
              name="originCountryCode"
              control={control}
              render={({ field }) => (
                <CountryAutocomplete value={field.value} onChange={field.onChange} />
              )}
            />
          )}
        </Field>
        <Field label="Ethnie" error={errors.ethnicity?.message}>
          {(props) => (
            <Input
              {...props}
              type="text"
              {...register("ethnicity")}
              placeholder="ex: Nord-Africain, Européen..."
              maxLength={50}
            />
          )}
        </Field>
        <Field label="Religion" error={errors.religion?.message}>
          {(props) => (
            <Select {...props} {...register("religion")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(religionOptions, religionLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Niveau de pratique" error={errors.religiosityLevel?.message}>
          {(props) => (
            <Select {...props} {...register("religiosityLevel")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(religiosityLevelOptions, religiosityLevelLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Langues parlées" error={errors.languagesSpoken?.message} full>
          {() => (
            <Controller
              name="languagesSpoken"
              control={control}
              render={({ field }) => (
                <TagInput label="" placeholder="Ajouter une langue" value={field.value ?? []} onChange={field.onChange} max={10} />
              )}
            />
          )}
        </Field>
      </Section>

      <Section title="Préférences relationnelles">
        <Field label="Objectif relationnel" error={errors.relationshipGoal?.message}>
          {(props) => (
            <Select {...props} {...register("relationshipGoal")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(relationshipGoalOptions, relationshipGoalLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fumeur" error={errors.smoker?.message}>
          {(props) => (
            <Select {...props} {...register("smoker")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(smokerOptions, smokerLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Consommation d'alcool" error={errors.drinker?.message}>
          {(props) => (
            <Select {...props} {...register("drinker")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(drinkerOptions, drinkerLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Souhaite des enfants" error={errors.wantsChildren?.message}>
          {(props) => (
            <Select {...props} {...register("wantsChildren")} defaultValue="">
              <option value="">Sélectionner</option>
              {optionEntries(wantsChildrenOptions, wantsChildrenLabels).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field error={errors.hasChildren?.message} full>
          {() => <Checkbox label="J'ai des enfants" {...register("hasChildren")} />}
        </Field>
      </Section>

      <Section title="Centres d'intérêt">
        <Field error={errors.interests?.message} full>
          {() => (
            <Controller
              name="interests"
              control={control}
              render={({ field }) => (
                <TagInput label="Centres d'intérêt" placeholder="ex: Lecture, Voyage..." value={field.value ?? []} onChange={field.onChange} max={20} />
              )}
            />
          )}
        </Field>
      </Section>

      <Section title="Confidentialité">
        <Field error={errors.specialCategoryConsent?.message} full>
          {() => (
            <Checkbox
              label="J'accepte que mes données relatives à ma religion et mon niveau de pratique religieuse soient collectées et utilisées dans le cadre de mon profil de rencontre (données sensibles au sens du RGPD)."
              {...register("specialCategoryConsent")}
            />
          )}
        </Field>
      </Section>

      {/* position:fixed, not sticky — this form sits in a plain flex-col
          inside the page (no bounded-height scroll container the way the
          chat pane has), and sticky's containing block turned out to be the
          form's own box: once the form's trailing padding was reached the
          bar just stopped and scrolled away with the rest of the content
          instead of staying pinned to the viewport. Fixed sidesteps that
          entirely. The bottom offset matches the mobile tab bar's actual
          rendered height exactly (56px content + its own safe-area
          padding, see AppShell) rather than a rounded bottom-16 guess —
          that 8px gap between the two bars on non-notched phones was
          exactly that rounding. Hidden at sm and up, where bottom-0 takes
          over since the tab bar itself is hidden there. The form's pb-28
          keeps the last section from sitting underneath it. Doubles as the completion
          meter so it doesn't also cost space at the top of the page as a
          separate element. Disabled when there's nothing new to save: a
          successful save invalidates my-profile, which reruns the reset()
          effect above and clears isDirty, so the button naturally goes back
          to disabled right after saving rather than inviting a redundant
          resave. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/95 backdrop-blur sm:bottom-0">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <ProgressBar value={completion} label="Profil complété" className="flex-1" />
            <button
              type="submit"
              disabled={!isDirty || isSubmitting || upsert.isPending}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-on-primary disabled:opacity-50"
            >
              {upsert.isPending && <StarSpinner className="h-4 w-4 text-current" />}
              {upsert.isPending ? "Enregistrement..." : "Enregistrer mon profil"}
            </button>
          </div>
          {isDirty && <span className="text-xs text-muted">Modifications non enregistrées</span>}
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title="Quitter sans enregistrer ?"
        description="Vous avez des modifications non enregistrées sur votre profil. Si vous quittez maintenant, elles seront perdues."
        confirmLabel="Quitter sans enregistrer"
        cancelLabel="Continuer l'édition"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </form>
  );
}

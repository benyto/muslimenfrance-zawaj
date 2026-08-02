// Same option vocabulary as the monolith's components/profile/DatingProfileForm.tsx
// (types/profile.ts) — kept identical on purpose so no value-mapping step is
// needed for the Phase 10 data migration. `profiles.gender` narrows the
// monolith's ['male','female','other'] to ['male','female'] to match the
// live DB check constraint and the subscription_products audience model.

export const genderOptions = ["male", "female"] as const;
export const genderLabels: Record<string, string> = {
  male: "Homme",
  female: "Femme",
};

export const eyeColorOptions = ["hazel", "blue", "brown", "green", "gray", "amber"] as const;
export const eyeColorLabels: Record<string, string> = {
  hazel: "Noisette",
  blue: "Bleus",
  brown: "Marrons",
  green: "Verts",
  gray: "Gris",
  amber: "Ambrés",
};

export const hairColorOptions = ["black", "brown", "blonde", "red", "gray", "white", "other"] as const;
export const hairColorLabels: Record<string, string> = {
  black: "Noirs",
  brown: "Bruns",
  blonde: "Blonds",
  red: "Roux",
  gray: "Gris",
  white: "Blancs",
  other: "Autre",
};

export const bodyTypeOptions = ["slim", "athletic", "curvy", "round", "average", "plus_size"] as const;
export const bodyTypeLabels: Record<string, string> = {
  slim: "Mince",
  athletic: "Athlétique",
  curvy: "Courbé",
  round: "Rond",
  average: "Moyen",
  plus_size: "Plus size",
};

export const educationLevelOptions = ["high_school", "bachelor", "master", "doctorate", "other"] as const;
export const educationLevelLabels: Record<string, string> = {
  high_school: "Baccalauréat",
  bachelor: "Licence",
  master: "Master",
  doctorate: "Doctorat",
  other: "Autre",
};

export const employmentStatusOptions = ["student", "employee", "entrepreneur", "unemployed", "retired", "other"] as const;
export const employmentStatusLabels: Record<string, string> = {
  student: "Étudiant",
  employee: "Salarié",
  entrepreneur: "Entrepreneur",
  unemployed: "Sans emploi",
  retired: "Retraité",
  other: "Autre",
};

export const religionOptions = ["islam", "christianity", "judaism", "buddhism", "hinduism", "no_religion", "other"] as const;
export const religionLabels: Record<string, string> = {
  islam: "Islam",
  christianity: "Christianisme",
  judaism: "Judaïsme",
  buddhism: "Bouddhisme",
  hinduism: "Hindouisme",
  no_religion: "Sans religion",
  other: "Autre",
};

export const religiosityLevelOptions = ["practicing", "moderate", "non_practicing", "spiritual"] as const;
export const religiosityLevelLabels: Record<string, string> = {
  practicing: "Pratiquant",
  moderate: "Modéré",
  non_practicing: "Non pratiquant",
  spiritual: "Spirituel",
};

export const relationshipGoalOptions = ["marriage", "serious_relationship", "casual_relationship", "friendship", "not_sure"] as const;
export const relationshipGoalLabels: Record<string, string> = {
  marriage: "Mariage",
  serious_relationship: "Relation sérieuse",
  casual_relationship: "Relation occasionnelle",
  friendship: "Amitié",
  not_sure: "Pas sûr",
};

export const smokerOptions = ["yes", "no", "occasional", "former"] as const;
export const smokerLabels: Record<string, string> = {
  yes: "Oui",
  no: "Non",
  occasional: "Occasionnel",
  former: "Ancien fumeur",
};

export const drinkerOptions = ["never", "socially", "regularly", "former"] as const;
export const drinkerLabels: Record<string, string> = {
  never: "Jamais",
  socially: "Socialement",
  regularly: "Régulièrement",
  former: "Ancien buveur",
};

export const wantsChildrenOptions = ["yes", "no", "maybe", "have_children"] as const;
export const wantsChildrenLabels: Record<string, string> = {
  yes: "Oui",
  no: "Non",
  maybe: "Peut-être",
  have_children: "J'en ai déjà",
};

import { Link } from "react-router";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="bg-gradient-to-r from-brand-rose-500 to-brand-purple-500 bg-clip-text text-4xl font-semibold text-transparent">
        Rencontre
      </h1>
      <p className="mt-3 max-w-sm text-neutral-500 dark:text-neutral-400">
        La communauté muslimenfrance, dédiée à la rencontre sérieuse.
      </p>
      <Link
        to="/auth/login"
        className="mt-8 rounded-xl bg-gradient-to-r from-brand-rose-500 to-brand-purple-500 px-6 py-3 text-sm font-medium text-white"
      >
        Se connecter
      </Link>
    </div>
  );
}

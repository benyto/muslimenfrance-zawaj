import { Link } from "react-router";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="bg-primary bg-clip-text text-4xl font-semibold text-transparent">
        Rencontre
      </h1>
      <p className="mt-3 max-w-sm text-muted">
        La communauté muslimenfrance, dédiée à la rencontre sérieuse.
      </p>
      <Link
        to="/auth/login"
        className="mt-8 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-on-primary"
      >
        Se connecter
      </Link>
    </div>
  );
}

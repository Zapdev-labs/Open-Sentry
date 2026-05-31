"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { GithubLogo } from "@phosphor-icons/react";

type AuthMode = "sign-in" | "sign-up";

function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "sign-up") {
      const result = await signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (result.error) {
        setError(result.error.message ?? "Sign up failed");
        setLoading(false);
        return;
      }
    } else {
      const result = await signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error) {
        const message = result.error.message ?? "Invalid credentials";
        setError(
          message.toLowerCase().includes("not found")
            ? "No account with that email. Switch to Sign up to create one."
            : message,
        );
        setLoading(false);
        return;
      }
    }

    router.push(from);
    router.refresh();
  }

  async function handleGithub() {
    await signIn.social({
      provider: "github",
      callbackURL: from,
    });
  }

  return (
    <main className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-header">
          <h1>{mode === "sign-in" ? "Welcome back" : "Create account"}</h1>
          <p className="meta">
            {mode === "sign-in"
              ? "Sign in to your monitoring workspace."
              : "Start tracking errors and performance in minutes."}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === "sign-in" ? "active" : ""}`}
            onClick={() => setMode("sign-in")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "sign-up" ? "active" : ""}`}
            onClick={() => setMode("sign-up")}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "sign-up" && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        {process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true" && (
          <>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <button type="button" className="btn btn-secondary github-btn" onClick={handleGithub}>
              <GithubLogo size={18} weight="fill" />
              Continue with GitHub
            </button>
          </>
        )}

        <p className="auth-footer meta">
          {mode === "sign-in" ? (
            <>
              New here?{" "}
              <button type="button" className="text-link" onClick={() => setMode("sign-up")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" className="text-link" onClick={() => setMode("sign-in")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page">Loading...</div>}>
      <AuthForm />
    </Suspense>
  );
}

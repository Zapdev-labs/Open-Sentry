import { SignIn } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-header">
          <div className="auth-header-row">
            <h1>Welcome back</h1>
            <ThemeToggle />
          </div>
          <p className="meta">Sign in to your monitoring workspace.</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: { width: "100%" },
              card: { boxShadow: "none", border: "none", padding: 0, background: "transparent" },
              formButtonPrimary: "btn",
              formFieldInput: "filter-select",
            },
          }}
        />
      </div>
    </main>
  );
}

import { SignUp } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <div className="auth-card fade-in">
        <div className="auth-header">
          <div className="auth-header-row">
            <h1>Create account</h1>
            <ThemeToggle />
          </div>
          <p className="meta">Start tracking errors and performance in minutes.</p>
        </div>
        <SignUp
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

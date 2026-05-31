import { Suspense } from "react";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="container" style={{ paddingTop: 120 }}>Loading...</div>}>{children}</Suspense>;
}

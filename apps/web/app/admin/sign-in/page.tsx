import type { Metadata } from "next";
import { AdminSignIn } from "@/components/admin/admin-sign-in";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false } };

export default function AdminSignInPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Admin sign-in</h1>
      <p className="mt-4 text-ink-muted">
        Connect an admin wallet and sign in. Access depends on the roles assigned to that wallet. Non-admin wallets are not let in.
      </p>
      <AdminSignIn />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/session-context";
import { WalletButton } from "@/components/wallet-button";

export function AdminSignIn() {
  const { session, error } = useSession();
  const router = useRouter();
  const isAdmin = session.status === "signed-in" && session.isAdmin;

  useEffect(() => {
    if (isAdmin) router.replace("/admin");
  }, [isAdmin, router]);

  return (
    <div className="mt-10 space-y-4">
      <WalletButton />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {session.status === "signed-in" && !session.isAdmin && (
        <p role="status" className="text-sm text-warn">This wallet is signed in but has no admin role.</p>
      )}
    </div>
  );
}

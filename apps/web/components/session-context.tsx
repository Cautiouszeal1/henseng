"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useAccountEffect, useDisconnect, useSignMessage } from "wagmi";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; address: string; chainId: number; isAdmin: boolean };

interface SessionApi {
  session: SessionState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signingIn: boolean;
  error: string | null;
}

const Ctx = createContext<SessionApi | null>(null);

async function fetchSession(): Promise<SessionState> {
  try {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await r.json();
    return data.signedIn
      ? { status: "signed-in", address: data.address, chainId: data.chainId, isAdmin: data.isAdmin }
      : { status: "signed-out" };
  } catch {
    return { status: "signed-out" };
  }
}

async function endSession() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const refresh = useCallback(async () => {
    setSession(await fetchSession());
  }, []);

  useEffect(() => {
    let alive = true;
    fetchSession().then((s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await endSession();
    setSession({ status: "signed-out" });
  }, []);

  // End the session when the user actually disconnects their wallet. This
  // listens for the disconnect event rather than reading `isConnected`, which
  // is briefly false on every page load while the wallet reconnects.
  useAccountEffect({
    onDisconnect() {
      endSession().then(() => setSession({ status: "signed-out" }));
    },
  });

  // End the session if the wallet switches to a different account.
  const switchedAccount =
    session.status === "signed-in" && isConnected && address !== undefined && address.toLowerCase() !== session.address;
  useEffect(() => {
    if (!switchedAccount) return;
    endSession().then(() => setSession({ status: "signed-out" }));
  }, [switchedAccount]);

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;
    setSigningIn(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", { cache: "no-store" });
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceData?.error?.message ?? "Could not start sign-in.");
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        uri: window.location.origin,
        nonce: nonceData.nonce,
        version: "1",
        issuedAt: new Date(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000),
        statement: "Sign in to HENSENG. This request only proves you own this wallet. It does not send a transaction or cost gas.",
      });
      const signature = await signMessageAsync({ message });
      const verify = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const result = await verify.json();
      if (!verify.ok) throw new Error(result?.error?.message ?? "Sign-in failed.");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed.";
      setError(/rejected|denied/i.test(msg) ? "You cancelled the signature request." : msg);
    } finally {
      setSigningIn(false);
    }
  }, [address, chainId, signMessageAsync, refresh]);

  return (
    <Ctx.Provider value={{ session, signIn, signOut: async () => { await signOut(); disconnect(); }, signingIn, error }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}

"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "./ui";
import { useSession } from "./session-context";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function WalletButton() {
  const { session, signIn, signOut, signingIn, error } = useSession();
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        if (!mounted) return <div className="h-10 w-36" aria-hidden />;
        if (!account || !chain) {
          return <Button onClick={openConnectModal}>Connect wallet</Button>;
        }
        if (chain.unsupported) {
          return (
            <Button variant="danger" onClick={openChainModal}>
              Switch network
            </Button>
          );
        }
        const signedIn = session.status === "signed-in";
        return (
          <div className="relative flex items-center gap-2">
            <button
              onClick={openChainModal}
              className="hidden h-10 items-center rounded-[var(--radius-control)] border border-rule-strong px-3 text-sm text-ink-muted hover:text-ink sm:inline-flex"
            >
              {chain.name}
            </button>
            {signedIn ? (
              <Button variant="secondary" onClick={openAccountModal} title="Account">
                {short(account.address)}
              </Button>
            ) : (
              <Button onClick={() => void signIn()} disabled={signingIn || session.status === "loading"} title={error ?? undefined}>
                {signingIn ? "Check your wallet…" : "Sign in"}
              </Button>
            )}
            {signedIn && (
              <Button variant="ghost" onClick={() => void signOut()}>
                Sign out
              </Button>
            )}
            {error && !signedIn && (
              <span
                role="alert"
                className="absolute right-0 top-full mt-2 w-72 rounded-[var(--radius-control)] border border-danger/40 bg-deep px-3 py-2 text-xs text-danger shadow-lg"
              >
                {error}
              </span>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

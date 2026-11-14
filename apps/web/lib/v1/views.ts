import "server-only";
import type { Profile } from "@henseng/db";

/** Public view of a person. Wallet addresses are public on-chain identities; nothing else private is exposed. */
export function personView(user: { id: string; profile: Profile | null; wallets?: { address: string }[] }) {
  return {
    id: user.id,
    username: user.profile?.username ?? null,
    displayName: user.profile?.displayName || null,
    avatarIndex: user.profile?.avatarIndex ?? 0,
    address: user.wallets?.[0]?.address ?? null,
  };
}

export const personInclude = { profile: true, wallets: { select: { address: true }, take: 1 } } as const;

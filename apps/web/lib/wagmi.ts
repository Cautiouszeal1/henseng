"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { WALLET_CHAINS } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/** WalletConnect-based wallets are only offered when a project ID is configured. */
export const walletConnectEnabled = projectId.length > 0;

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: walletConnectEnabled
        ? [injectedWallet, metaMaskWallet, coinbaseWallet, rainbowWallet, walletConnectWallet]
        : [injectedWallet, coinbaseWallet],
    },
  ],
  { appName: "HENSENG", projectId: projectId || "walletconnect-disabled" },
);

export const wagmiConfig = createConfig({
  chains: WALLET_CHAINS,
  connectors,
  ssr: true,
  transports: Object.fromEntries(WALLET_CHAINS.map((c) => [c.id, http()])) as Record<
    (typeof WALLET_CHAINS)[number]["id"],
    ReturnType<typeof http>
  >,
});

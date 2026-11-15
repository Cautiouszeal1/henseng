import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API_URL, useApi } from "../api/api-context";
import type { Person } from "../api/types";
import { useResolveRecipient } from "../wallet/resolve-recipient";
import { useWallet } from "../wallet/wallet-context";
import { type ChatMessage, type MessagingClient } from "./model";
import { onDeviceWipe } from "../wallet/device-wipe";
import { deleteDbKey, getDbKey } from "./key-storage";
import { createMemoryClient } from "./memory-client";
import { clearLocalMessagingStorage, connectXmtp } from "./xmtp";

/**
 * End-to-end encrypted messaging over XMTP. Enabled by EXPO_PUBLIC_XMTP_ENV
 * ("dev" for testing, "production" for launch). Without it, Chats shows the
 * labelled preview.
 */
export const XMTP_ENV = (process.env.EXPO_PUBLIC_XMTP_ENV ?? "") as "" | "dev" | "production" | "memory";
/** "memory" = simulated, unencrypted in-memory client for UI tests only (see memory-client.ts). */
export const MESSAGING_TEST_MODE = XMTP_ENV === "memory";

type Status = "off" | "connecting" | "ready" | "error";
const CONNECT_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_XMTP_CONNECT_TIMEOUT_MS) || 45_000;
type Listener = (m: ChatMessage) => void;

interface MessagingApi {
  status: Status;
  error: string | null;
  client: MessagingClient | null;
  retry: () => void;
  /** Subscribe to every new incoming/outgoing message. */
  subscribe: (fn: Listener) => () => void;
  /** Bumps whenever any message arrives — chat lists refresh on it. */
  version: number;
  /** Resolves "0x…", "name.eth" or "@username" to an address, with a reason when it can't. */
  resolveTarget: (input: string) => Promise<{ address: `0x${string}`; label: string } | { error: string }>;
  /** HENSENG profile for an address, when the person has one. */
  profileFor: (address?: string) => Person | undefined;
  lastRead: Record<string, number>;
  markRead: (chatId: string) => void;
  /** Inbox chats with unread messages from others (0 until connected). */
  unreadChats: number;
}

const Ctx = createContext<MessagingApi | null>(null);
const READ_KEY = "henseng.chatReads.v1";

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { status: walletStatus, address, signMessage } = useWallet();
  const api = useApi();
  const [status, setStatus] = useState<Status>(XMTP_ENV ? "connecting" : "off");
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<MessagingClient | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [version, setVersion] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, Person>>({});
  const [lastRead, setLastRead] = useState<Record<string, number>>({});

  // Removing the wallet erases this device's messages: the local database, and on phones the key that decrypts it.
  const wipeRef = useRef({ client: null as MessagingClient | null, address: null as string | null });
  wipeRef.current = { client, address };
  useEffect(
    () =>
      onDeviceWipe(async () => {
        const { client: c, address: a } = wipeRef.current;
        await c?.wipeLocal().catch(() => undefined);
        await clearLocalMessagingStorage().catch(() => undefined);
        if (a) await deleteDbKey(a).catch(() => undefined);
        setClient(null);
        setProfiles({});
        setLastRead({});
      }),
    [],
  );
  const listeners = useRef(new Set<Listener>());
  const pendingLookups = useRef(new Set<string>());
  /** Addresses already asked about, including ones with no HENSENG profile, so misses aren't re-fetched every render. */
  const lookedUp = useRef(new Set<string>());

  useEffect(() => {
    AsyncStorage.getItem(READ_KEY).then((raw) => raw && setLastRead(JSON.parse(raw) as Record<string, number>));
  }, []);

  useEffect(() => {
    if (!XMTP_ENV || walletStatus !== "unlocked" || !address) {
      setStatus(XMTP_ENV ? "connecting" : "off");
      return;
    }
    let cancelled = false;
    let c: MessagingClient | null = null;
    let stop: (() => void) | null = null;
    (async () => {
      setStatus("connecting");
      setError(null);
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const connecting =
          XMTP_ENV === "memory"
            ? Promise.resolve(createMemoryClient(address))
            : connectXmtp({ env: XMTP_ENV, address, signMessage, dbEncryptionKey: await getDbKey(address) });
        // The SDK keeps retrying when the network is unreachable; give the user a clear error and a retry instead.
        c = await Promise.race([
          connecting,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              connecting.then((late) => late.close()).catch(() => undefined);
              reject(new Error("Couldn't reach the XMTP network. Check your connection and try again."));
            }, CONNECT_TIMEOUT_MS);
          }),
        ]);
        clearTimeout(timer);
        if (cancelled || timedOut) return c.close();
        await c.sync().catch(() => undefined);
        stop = c.streamAll((m) => {
          listeners.current.forEach((fn) => fn(m));
          setVersion((v) => v + 1);
        });
        setClient(c);
        setStatus("ready");
      } catch (e) {
        clearTimeout(timer);
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't connect to encrypted messaging.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
      c?.close();
      setClient(null);
    };
  }, [walletStatus, address, signMessage, attempt]);

  const lookup = useCallback(
    (addr: string) => {
      const a = addr.toLowerCase();
      if (!API_URL || api.status !== "ready" || lookedUp.current.has(a)) return;
      lookedUp.current.add(a);
      pendingLookups.current.add(a);
      // Batch lookups that arrive in the same tick.
      setTimeout(() => {
        const batch = [...pendingLookups.current];
        pendingLookups.current.clear();
        if (!batch.length) return;
        void api
          .request<{ profiles: Record<string, Person> }>("POST", "/profiles/lookup", { addresses: batch })
          .then((r) => setProfiles((p) => ({ ...p, ...r.profiles })))
          // Allow a failed batch to be retried, but not before 30 seconds (avoids hammering a rate limit).
          .catch(() => setTimeout(() => batch.forEach((x) => lookedUp.current.delete(x)), 30_000));
      }, 50);
    },
    [api],
  );

  const profileFor = useCallback(
    (addr?: string) => {
      if (!addr) return undefined;
      const p = profiles[addr.toLowerCase()];
      if (!p) lookup(addr);
      return p;
    },
    [profiles, lookup],
  );

  const resolveRecipient = useResolveRecipient();
  const resolveTarget = useCallback<MessagingApi["resolveTarget"]>(
    async (input) => {
      const r = await resolveRecipient(input);
      if ("person" in r && r.person) {
        const person = r.person;
        setProfiles((prev) => ({ ...prev, [r.address]: person }));
      }
      return "error" in r ? r : { address: r.address, label: r.label };
    },
    [resolveRecipient],
  );

  const markRead = useCallback((chatId: string) => {
    setLastRead((prev) => {
      const next = { ...prev, [chatId]: Date.now() };
      void AsyncStorage.setItem(READ_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Unread chat count for the tab badge, recomputed whenever messages arrive or chats are read.
  const [unreadChats, setUnreadChats] = useState(0);
  useEffect(() => {
    if (!client) return setUnreadChats(0);
    let stale = false;
    client
      .listChats("inbox")
      .then((chats) => {
        if (stale) return;
        setUnreadChats(chats.filter((c) => !!c.lastMessage && !c.lastMessage.fromMe && c.lastMessage.sentAt.getTime() > (lastRead[c.id] ?? 0)).length);
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [client, version, lastRead]);

  const value = useMemo<MessagingApi>(
    () => ({
      status,
      error,
      client,
      retry: () => setAttempt((n) => n + 1),
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
      version,
      resolveTarget,
      profileFor,
      lastRead,
      markRead,
      unreadChats,
    }),
    [status, error, client, version, resolveTarget, profileFor, lastRead, markRead, unreadChats],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMessaging() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMessaging must be used inside MessagingProvider");
  return v;
}

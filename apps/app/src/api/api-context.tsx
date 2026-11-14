import { createSiweMessage } from "viem/siwe";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { useProfile } from "../profile/profile-context";
import { useWallet } from "../wallet/wallet-context";
import { clearToken, loadToken, saveToken } from "./token-storage";
import { ApiError, type Me } from "./types";

/**
 * Connection to the HENSENG API. Configured with EXPO_PUBLIC_API_URL.
 *
 * Sign-in is automatic after the wallet unlocks: the app signs a
 * Sign-In with Ethereum message with the user's own key and exchanges it for
 * a 30-day session token (shown under Profile → Devices, revocable).
 * Without an API URL the app runs in preview mode for social features.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

type Status = "off" | "connecting" | "ready" | "error";

interface ApiApi {
  status: Status;
  me: Me | null;
  error: string | null;
  request: <T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => Promise<T>;
  refreshMe: () => Promise<void>;
  retry: () => void;
}

const Ctx = createContext<ApiApi | null>(null);

async function raw<T>(method: string, path: string, token: string | null, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "OFFLINE", "Can't reach HENSENG. Check your connection.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? "ERROR", data?.error?.message ?? "Something went wrong.");
  return data as T;
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const { status: walletStatus, address, signMessage } = useWallet();
  const { profile, update: updateLocal } = useProfile();
  const [status, setStatus] = useState<Status>(API_URL ? "connecting" : "off");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const token = useRef<string | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const signIn = useCallback(async () => {
    const n = await raw<{ nonce: string; domain: string; uri: string }>("POST", "/auth/nonce", null);
    const message = createSiweMessage({
      address: address!,
      chainId: 1,
      domain: n.domain,
      uri: n.uri,
      nonce: n.nonce,
      version: "1",
      issuedAt: new Date(),
      statement: "Sign in to HENSENG. This proves you own this wallet. It is not a transaction and costs nothing.",
    });
    const signature = await signMessage(message);
    const platform = Platform.OS === "web" ? "web" : Platform.OS === "ios" ? "ios" : "android";
    const r = await raw<{ token: string }>("POST", "/auth/token", null, { message, signature, platform, deviceName: Platform.OS === "web" ? "Web browser" : undefined });
    await saveToken(r.token);
    return r.token;
  }, [address, signMessage]);

  // Connect whenever the wallet is unlocked.
  useEffect(() => {
    if (!API_URL || walletStatus !== "unlocked" || !address) {
      setStatus(API_URL ? "connecting" : "off");
      setMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("connecting");
      setError(null);
      try {
        let t = await loadToken();
        let current: Me | null = null;
        if (t) {
          try {
            current = await raw<Me>("GET", "/me", t);
            if (current.address?.toLowerCase() !== address.toLowerCase()) current = null; // token belongs to another wallet
          } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 401) throw e;
          }
        }
        if (!current) {
          t = await signIn();
          current = await raw<Me>("GET", "/me", t);
        }
        // First sign-in on this server: publish the profile the user set up during onboarding.
        const local = profileRef.current;
        if (!current.displayName && (local.displayName || local.username)) {
          const base = { displayName: local.displayName, bio: local.bio, avatarIndex: local.avatarIndex, coverIndex: local.coverIndex };
          await raw("PATCH", "/me/profile", t, local.username ? { ...base, username: local.username } : base).catch(async () => {
            // Username already taken (or reserved) on the server: publish the rest, keep the name free to change.
            await raw("PATCH", "/me/profile", t, base).catch(() => undefined);
          });
          current = await raw<Me>("GET", "/me", t);
        } else if (current.displayName) {
          await updateLocal({ displayName: current.displayName, username: current.username ?? "", bio: current.bio, avatarIndex: current.avatarIndex, coverIndex: current.coverIndex });
        }
        if (cancelled) return;
        token.current = t;
        setMe(current);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not connect.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletStatus, address, signIn, updateLocal, attempt]);

  const request = useCallback(async <T,>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => {
    if (!API_URL) throw new ApiError(0, "OFF", "Social features aren't connected in this build.");
    try {
      return await raw<T>(method, path, token.current, body);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && token.current) {
        // Session revoked or expired: sign in again once, then retry.
        await clearToken();
        token.current = await signIn();
        return raw<T>(method, path, token.current, body);
      }
      throw e;
    }
  }, [signIn]);

  const refreshMe = useCallback(async () => {
    if (status !== "ready") return;
    setMe(await request<Me>("GET", "/me"));
  }, [request, status]);

  const value = useMemo<ApiApi>(() => ({ status, me, error, request, refreshMe, retry: () => setAttempt((n) => n + 1) }), [status, me, error, request, refreshMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApi must be used inside ApiProvider");
  return v;
}

/** Small data hook: loads on mount and when deps change; exposes reload. */
export function useApiQuery<T>(path: string | null, deps: unknown[] = []) {
  const { request, status } = useApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!path || status !== "ready") return;
    setLoading(true);
    try {
      setData(await request<T>("GET", path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, status, request, ...deps]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { onDeviceWipe } from "../wallet/device-wipe";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The user's public identity. Kept on this device, and synced to the HENSENG API
 * when the app is connected (username uniqueness is enforced there).
 */
export interface Profile {
  displayName: string;
  username: string;
  bio: string;
  coverIndex: number;
  avatarIndex: number;
  showOnline: boolean;
  readReceipts: boolean;
  allowMessagesFrom: "everyone" | "contacts";
}

export const DEFAULT_PROFILE: Profile = {
  displayName: "",
  username: "",
  bio: "",
  coverIndex: 0,
  avatarIndex: 0,
  showOnline: true,
  readReceipts: true,
  allowMessagesFrom: "contacts",
};

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const KEY = "henseng.profile.v1";

interface ProfileApi {
  profile: Profile;
  ready: boolean;
  update: (patch: Partial<Profile>) => Promise<void>;
  clear: () => Promise<void>;
}

const Ctx = createContext<ProfileApi | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setProfile({ ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) });
      })
      .finally(() => setReady(true));
  }, []);

  const update = useCallback(async (patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      void AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(KEY);
    setProfile(DEFAULT_PROFILE);
  }, []);
  useEffect(() => onDeviceWipe(() => setProfile(DEFAULT_PROFILE)), []);

  const value = useMemo(() => ({ profile, ready, update, clear }), [profile, ready, update, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProfile must be used inside ProfileProvider");
  return v;
}

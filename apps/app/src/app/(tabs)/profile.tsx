import { shortAddress } from "@henseng/wallet";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bell,
  ChevronRight,
  Copy,
  KeyRound,
  Lock,
  Monitor,
  Moon,
  Pencil,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserX,
  Wallet,
  Eye,
  MessageSquareLock,
  Cloud,
  CloudOff,
  Laptop,
  type LucideIcon,
} from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Platform, Switch, View } from "react-native";
import { useApi, useApiQuery } from "../../api/api-context";
import { clearToken } from "../../api/token-storage";
import type { CommunityCard, Device } from "../../api/types";
import { PREVIEW_COMMUNITIES } from "../../data/preview";
import { router as nav } from "expo-router";
import { useProfile } from "../../profile/profile-context";
import { Avatar } from "../../ui/avatar";
import { Sheet, useToast } from "../../ui/overlays";
import { Button, Card, Field, Pill, SectionHeader, Tap, Text } from "../../ui/primitives";
import { Screen } from "../../ui/screen";
import { useLayout, useTheme, type ThemePreference } from "../../ui/theme";
import { coverGradients, radius } from "../../ui/tokens";
import { vaultLocationLabel } from "../../wallet/vault-storage";
import { useWallet, WrongPasswordError } from "../../wallet/wallet-context";

function Row({ icon: Icon, label, value, onPress, right, danger }: { icon: LucideIcon; label: string; value?: string; onPress?: () => void; right?: ReactNode; danger?: boolean }) {
  const { theme } = useTheme();
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: danger ? theme.negative + "1A" : theme.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={danger ? theme.negative : theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" style={danger ? { color: theme.negative } : undefined}>{label}</Text>
        {value ? <Text variant="caption" tone="secondary" numberOfLines={1}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={theme.textTertiary} /> : null)}
    </View>
  );
  return onPress ? (
    <Tap onPress={onPress} haptic={false} accessibilityRole="button" accessibilityLabel={label}>
      {content}
    </Tap>
  ) : (
    content
  );
}

function Group({ children }: { children: ReactNode[] | ReactNode }) {
  const { theme } = useTheme();
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <Card padded={false}>
      {items.map((c, i) => (
        <View key={i} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}>{c}</View>
      ))}
    </Card>
  );
}

export default function ProfileScreen() {
  const { theme, preference, setPreference } = useTheme();
  const { isDesktop } = useLayout();
  const { profile, update, clear } = useProfile();
  const { address, lock, revealPhrase, removeWallet, verifyPassword } = useWallet();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "reveal" | "remove" | "deleteAccount">(null);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cover = coverGradients[profile.coverIndex % coverGradients.length]!;
  const api = useApi();
  const live = api.status !== "off";
  const devices = useApiQuery<{ devices: Device[] }>(live ? "/me/devices" : null);
  const myCommunities = useApiQuery<{ communities: CommunityCard[] }>(live ? "/communities?scope=joined" : null);
  const joined: { id: string; name: string; avatarIndex?: number; slug?: string }[] = live
    ? (myCommunities.data?.communities ?? []).map((c) => ({ id: c.id, name: c.name, avatarIndex: c.avatarIndex, slug: c.slug }))
    : PREVIEW_COMMUNITIES.filter((c) => c.joined);

  const closeSheet = () => {
    setSheet(null);
    setPassword("");
    setPhrase(null);
    setError(null);
  };

  const header = (
    <View style={{ borderRadius: radius.xl, overflow: "hidden", backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
      <LinearGradient colors={cover} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 130 }} />
      <View style={{ alignItems: "center", marginTop: -58, paddingHorizontal: 20, paddingBottom: 22, gap: 10 }}>
        <View style={{ padding: 4, borderRadius: 70, backgroundColor: theme.card }}>
          <Avatar name={profile.displayName || "You"} size={108} presence={profile.showOnline ? "online" : undefined} gradientIndex={profile.avatarIndex} />
        </View>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text variant="title">{profile.displayName || "Add your name"}</Text>
          <Text tone="secondary">{profile.username ? `@${profile.username}` : "No username yet"}</Text>
        </View>
        {profile.bio ? <Text style={{ textAlign: "center", maxWidth: 420 }}>{profile.bio}</Text> : null}
        <View style={{ flexDirection: "row", gap: 28, paddingVertical: 6 }}>
          <View style={{ alignItems: "center" }}>
            <Text variant="heading">{joined.length}</Text>
            <Text variant="caption" tone="secondary">Communities</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text variant="heading">{profile.showOnline ? "Online" : "Hidden"}</Text>
            <Text variant="caption" tone="secondary">Status</Text>
          </View>
        </View>
        <Button label="Edit profile" icon={Pencil} onPress={() => router.push("/edit-profile")} style={{ alignSelf: "stretch" }} />
      </View>
    </View>
  );

  const themeOptions: { key: ThemePreference; label: string; icon: LucideIcon }[] = [
    { key: "system", label: "System", icon: Monitor },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "light", label: "Light", icon: Sun },
  ];

  const settings = (
    <View style={{ gap: 24 }}>
      <View>
        <SectionHeader title="Wallet identity" />
        <Group>
          <Row
            icon={Wallet}
            label="Ethereum address"
            value={address ? shortAddress(address, 8, 6) : undefined}
            onPress={async () => {
              if (!address) return;
              await Clipboard.setStringAsync(address);
              toast("Address copied", "success");
            }}
            right={<Copy size={16} color={theme.textTertiary} />}
          />
        </Group>
      </View>

      <View>
        <SectionHeader title="Appearance" />
        <Card style={{ flexDirection: "row", gap: 8, padding: 8 }}>
          {themeOptions.map((o) => (
            <Tap key={o.key} onPress={() => setPreference(o.key)} accessibilityRole="radio" accessibilityState={{ checked: preference === o.key }} style={{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: radius.md, backgroundColor: preference === o.key ? theme.accentSoft : "transparent" }}>
              <o.icon size={18} color={preference === o.key ? theme.accent : theme.textSecondary} />
              <Text variant="label" style={{ color: preference === o.key ? theme.accent : theme.textSecondary }}>{o.label}</Text>
            </Tap>
          ))}
        </Card>
      </View>

      <View>
        <SectionHeader title="Privacy" />
        <Group>
          <Row icon={Eye} label="Show when I'm online" right={<Switch value={profile.showOnline} onValueChange={(v) => { void update({ showOnline: v }); if (api.status === "ready") void api.request("PATCH", "/me/profile", { showOnline: v }).catch(() => undefined); }} trackColor={{ true: theme.accent, false: theme.surface }} thumbColor="#FFFFFF" accessibilityLabel="Show when I'm online" />} />
          <Row icon={MessageSquareLock} label="Read receipts" right={<Switch value={profile.readReceipts} onValueChange={(v) => void update({ readReceipts: v })} trackColor={{ true: theme.accent, false: theme.surface }} thumbColor="#FFFFFF" accessibilityLabel="Read receipts" />} />
          <Row
            icon={MessageSquareLock}
            label="Who can message me"
            value={profile.allowMessagesFrom === "contacts" ? "People I've accepted (others go to Requests)" : "Everyone (straight to my inbox)"}
            onPress={() => void update({ allowMessagesFrom: profile.allowMessagesFrom === "contacts" ? "everyone" : "contacts" })}
          />
        </Group>
        <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>
          {live ? "Online status syncs to your HENSENG profile. Read receipts and who can message you apply to your encrypted chats." : "Privacy settings are saved on this device."}
        </Text>
      </View>

      <View>
        <SectionHeader title="Security" />
        <Group>
          <Row icon={KeyRound} label="Show recovery phrase" value="Requires your password" onPress={() => setSheet("reveal")} />
          <Row icon={Lock} label="Lock HENSENG now" value="Also locks automatically after 15 minutes idle" onPress={lock} />
          <Row icon={ShieldCheck} label="Where your keys live" value={`Encrypted in ${vaultLocationLabel}`} />
        </Group>
      </View>

      <View>
        <SectionHeader title="Notifications and devices" />
        <Group>
          <Row icon={Bell} label="Notifications" value={live ? "Announcements, role changes and account alerts" : "Not connected in this build"} onPress={() => nav.push("/notifications")} right={api.me?.unreadNotifications ? <Pill label={`${api.me.unreadNotifications} new`} tone="accent" /> : undefined} />
          <Row
            icon={live && api.status === "ready" ? Cloud : CloudOff}
            label={api.status === "ready" ? "Connected to HENSENG" : api.status === "connecting" ? "Connecting…" : api.status === "error" ? "Can't reach HENSENG" : "Offline build"}
            value={api.status === "ready" ? "Profile and communities sync across your devices" : api.status === "error" ? api.error ?? "Tap to retry" : "Profile is saved on this device only"}
            onPress={api.status === "error" ? api.retry : undefined}
          />
          {live && devices.data ? (
            devices.data.devices.map((d) => (
              <Row
                key={d.id}
                icon={d.platform === "web" || d.platform === "extension" ? Laptop : Smartphone}
                label={d.deviceName || (d.platform === "ios" ? "iPhone / iPad" : d.platform === "android" ? "Android" : d.platform === "extension" ? "Chrome extension" : "Web browser")}
                value={`Signed in ${new Date(d.createdAt).toLocaleDateString()} · last active ${new Date(d.lastUsedAt).toLocaleDateString()}`}
                right={
                  d.current ? (
                    <Pill label="This device" tone="positive" />
                  ) : (
                    <Tap
                      onPress={async () => {
                        await api.request("DELETE", `/me/devices/${d.id}`).catch(() => undefined);
                        toast("Signed out of that device", "success");
                        await devices.reload();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Sign out of this device"
                    >
                      <Text variant="caption" tone="negative">Sign out</Text>
                    </Tap>
                  )
                }
              />
            ))
          ) : (
            <Row icon={Smartphone} label="This device" value={`${Platform.OS === "web" ? "Web browser" : Platform.OS === "ios" ? "iPhone / iPad" : "Android"} · active now`} right={<Pill label="Current" tone="positive" />} />
          )}
        </Group>
      </View>

      <View>
        <SectionHeader title="Danger zone" />
        <Group>
          <Row icon={Trash2} label="Remove wallet from this device" value="You'll need your recovery phrase to restore it" onPress={() => setSheet("remove")} danger />
          {live ? (
            <Row icon={UserX} label="Delete HENSENG account" value="Erases your profile, communities and messages from HENSENG" onPress={() => { setConfirmText(""); setSheet("deleteAccount"); }} danger />
          ) : null}
        </Group>
      </View>
    </View>
  );

  return (
    <Screen title="Profile" maxWidth={isDesktop ? 1080 : 760}>
      {isDesktop ? (
        <View style={{ flexDirection: "row", gap: 28, alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 24 }}>
            {header}
            <View>
              <SectionHeader title="Communities" />
              <Card style={{ gap: 12 }}>
                {joined.length ? joined.map((c) => (
                  <Tap key={c.id} haptic={false} disabled={!c.slug} onPress={() => c.slug && nav.push({ pathname: "/community/[id]", params: { id: c.slug } })} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Avatar name={c.name} seed={c.id} size={40} square gradientIndex={c.avatarIndex} />
                    <Text variant="bodyStrong" style={{ flex: 1 }}>{c.name}</Text>
                    {live ? null : <Pill label="Preview" tone="warning" />}
                  </Tap>
                )) : <Text tone="secondary">You haven't joined any communities yet.</Text>}
              </Card>
            </View>
          </View>
          <View style={{ flex: 1.2 }}>{settings}</View>
        </View>
      ) : (
        <View style={{ gap: 24 }}>
          {header}
          {settings}
        </View>
      )}

      <Sheet visible={sheet === "reveal"} onClose={closeSheet} title="Recovery phrase">
        {phrase ? (
          <>
            <Text tone="negative" variant="caption">Never share these words. HENSENG support will never ask for them.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {phrase.split(" ").map((w, i) => (
                <View key={i} style={{ width: "30%", flexGrow: 1, flexDirection: "row", gap: 6, padding: 10, borderRadius: 10, backgroundColor: theme.surface }}>
                  <Text variant="label" tone="tertiary">{i + 1}</Text>
                  <Text variant="bodyStrong">{w}</Text>
                </View>
              ))}
            </View>
            <Button label="Hide" kind="secondary" onPress={closeSheet} />
          </>
        ) : (
          <>
            <Text tone="secondary">Enter your password to show your 12-word recovery phrase. Make sure no one can see your screen.</Text>
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry error={error} autoComplete="current-password" />
            <Button
              label="Show phrase"
              loading={busy}
              disabled={!password}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  setPhrase(await revealPhrase(password));
                } catch (e) {
                  setError(e instanceof WrongPasswordError ? "That password is not correct." : "Could not read the wallet.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        )}
      </Sheet>

      <Sheet visible={sheet === "deleteAccount"} onClose={closeSheet} title="Delete your HENSENG account?">
        <Text tone="secondary">
          This permanently erases what HENSENG stores about you: your profile and username, your community memberships and messages, notifications and
          signed-in devices. Communities you own pass to their most senior member, or are deleted if you're the only one in them.
        </Text>
        <Text tone="secondary">
          Your wallet and funds are not affected: they're on this device and the blockchain, not on HENSENG. Encrypted private chats live on the XMTP
          network and stay there. If you unlock HENSENG again later, a new, empty account is created for your wallet.
        </Text>
        <Field label="Password" value={password} onChangeText={(v) => { setPassword(v); setError(null); }} secureTextEntry autoCapitalize="none" error={error} />
        <Field label='Type "DELETE" to confirm' value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} />
        <Button
          label="Delete account"
          kind="danger"
          loading={busy}
          disabled={!password || confirmText.trim() !== "DELETE"}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              if (!(await verifyPassword(password))) return setError("That password is not correct.");
              await api.request("DELETE", "/me", { confirm: "DELETE" });
              await clearToken();
              await clear();
              closeSheet();
              toast("Your HENSENG account was deleted", "success");
              lock();
            } catch {
              setError("Couldn't delete your account right now. Check your connection and try again.");
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button label="Cancel" kind="secondary" onPress={closeSheet} />
      </Sheet>

      <Sheet visible={sheet === "remove"} onClose={closeSheet} title="Remove wallet?">
        <Text tone="secondary">
          This deletes the encrypted wallet and your profile from this device. Your funds stay on the blockchain. You can only get them back
          with your recovery phrase.
        </Text>
        <Button
          label="Remove wallet"
          kind="danger"
          onPress={async () => {
            await removeWallet();
            await clear();
            closeSheet();
          }}
        />
        <Button label="Cancel" kind="secondary" onPress={closeSheet} />
      </Sheet>
    </Screen>
  );
}

import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Check, X } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useApi } from "../api/api-context";
import { USERNAME_RE, useProfile } from "../profile/profile-context";
import { Avatar } from "../ui/avatar";
import { useToast } from "../ui/overlays";
import { Button, Field, IconButton, SectionHeader, Tap, Text } from "../ui/primitives";
import { Screen } from "../ui/screen";
import { useTheme } from "../ui/theme";
import { COVER_COUNT, ProfileCover } from "../ui/art";
import { avatarGradients, radius } from "../ui/tokens";

export default function EditProfile() {
  const { theme } = useTheme();
  const { profile, update } = useProfile();
  const toast = useToast();
  const { status, request, refreshMe } = useApi();
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [coverIndex, setCoverIndex] = useState(profile.coverIndex);
  const [avatarIndex, setAvatarIndex] = useState(profile.avatarIndex);
  const usernameError = username && !USERNAME_RE.test(username) ? "3–20 characters: lowercase letters, numbers and _" : null;

  const save = async () => {
    if (usernameError) return;
    const next = { displayName: displayName.trim(), username: username.trim(), bio: bio.trim(), coverIndex, avatarIndex };
    setServerError(null);
    if (status === "ready") {
      setSaving(true);
      try {
        await request("PATCH", "/me/profile", { ...next, username: next.username || null });
        await refreshMe();
      } catch (e) {
        setServerError(e instanceof Error ? e.message : "Couldn't save your profile.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    await update(next);
    toast(status === "ready" ? "Profile saved" : "Profile saved on this device", "success");
    router.back();
  };

  return (
    <Screen title="Edit profile" right={<IconButton icon={X} label="Close" onPress={() => router.back()} />}>
      <View style={{ gap: 22 }}>
        <View style={{ borderRadius: radius.xl, overflow: "hidden" }}>
          <ProfileCover index={coverIndex} height={120} />
          <View style={{ alignItems: "center", marginTop: -48 }}>
            <View style={{ padding: 4, borderRadius: 60, backgroundColor: theme.bg }}>
              <Avatar name={displayName || "You"} size={92} gradientIndex={avatarIndex} />
            </View>
          </View>
        </View>

        <View>
          <SectionHeader title="Cover" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {Array.from({ length: COVER_COUNT }, (_, i) => (
              <Tap key={i} onPress={() => setCoverIndex(i)} accessibilityRole="radio" accessibilityState={{ checked: coverIndex === i }} accessibilityLabel={`Cover ${i + 1}`} style={{ flex: 1, height: 52, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: coverIndex === i ? theme.text : "transparent" }}>
                <ProfileCover index={i} height={52} />
                {coverIndex === i ? (
                  <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" }}>
                    <Check size={18} color="#FFFFFF" />
                  </View>
                ) : null}
              </Tap>
            ))}
          </View>
        </View>

        <View>
          <SectionHeader title="Avatar colour" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {avatarGradients.map((g, i) => (
              <Tap key={i} onPress={() => setAvatarIndex(i)} accessibilityRole="radio" accessibilityState={{ checked: avatarIndex === i }} accessibilityLabel={`Avatar colour ${i + 1}`} style={{ borderRadius: 24, borderWidth: 2, borderColor: avatarIndex === i ? theme.text : "transparent", padding: 2 }}>
                <LinearGradient colors={g} style={{ width: 38, height: 38, borderRadius: 19 }} />
              </Tap>
            ))}
          </View>
          <Text variant="caption" tone="tertiary" style={{ marginTop: 8 }}>Photo uploads arrive with media storage in a later update.</Text>
        </View>

        <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
        <Field label="Username" value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} autoCapitalize="none" error={usernameError ?? serverError} hint={status === "ready" ? "Unique across HENSENG. People can find you by it." : "Saved on this device."} />
        <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={160} style={{ minHeight: 90, textAlignVertical: "top" }} hint={`${bio.length}/160`} />
        <Button label="Save profile" loading={saving} onPress={() => void save()} disabled={!!usernameError} />
      </View>
    </Screen>
  );
}

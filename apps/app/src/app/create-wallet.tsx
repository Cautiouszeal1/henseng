import { generateMnemonic, passwordProblems, pickConfirmationPositions } from "@henseng/wallet";
import { Eye, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { USERNAME_RE, useProfile } from "../profile/profile-context";
import { OnboardingFrame } from "../ui/onboarding-frame";
import { Button, Field, Tap, Text } from "../ui/primitives";
import { useToast } from "../ui/overlays";
import { useWallet } from "../wallet/wallet-context";

type Step = "intro" | "phrase" | "confirm" | "profile";

export default function CreateWallet() {
  const [step, setStep] = useState<Step>("intro");
  const [mnemonic] = useState(() => generateMnemonic(12));
  const words = mnemonic.split(" ");
  const positions = useMemo(() => pickConfirmationPositions(words.length, 3), [words.length]);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { createWallet } = useWallet();
  const { update } = useProfile();
  const toast = useToast();

  if (step === "intro") {
    return (
      <OnboardingFrame
        step={1}
        total={4}
        title="Create your wallet"
        subtitle="Your HENSENG account is a wallet that only you control."
        footer={<Button label="Show my recovery phrase" icon={Eye} onPress={() => setStep("phrase")} />}
      >
        {[
          { icon: KeyRound, title: "12-word recovery phrase", body: "It is the master key to your account and funds. It is created on this device and never sent to us." },
          { icon: ShieldCheck, title: "Write it down, offline", body: "On paper, in order. Anyone with these words can take everything. HENSENG will never ask for them." },
          { icon: TriangleAlert, title: "We can't recover it", body: "If you lose the phrase and this device, no one, including HENSENG, can restore your account." },
        ].map((r) => (
          <View key={r.title} style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(137,87,255,0.2)", alignItems: "center", justifyContent: "center" }}>
              <r.icon size={20} color="#C4ADFF" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" tone="inverse">{r.title}</Text>
              <Text variant="caption" style={{ color: "#B8B6C6" }}>{r.body}</Text>
            </View>
          </View>
        ))}
      </OnboardingFrame>
    );
  }

  if (step === "phrase") {
    return (
      <OnboardingFrame
        step={2}
        total={4}
        title="Your recovery phrase"
        subtitle="Write these 12 words down in order. Don't screenshot or copy them."
        onBack={() => setStep("intro")}
        footer={<Button label="I've written it down" disabled={!revealed} onPress={() => setStep("confirm")} />}
      >
        <Tap
          onPress={() => setRevealed(true)}
          haptic={false}
          accessibilityRole="button"
          accessibilityLabel={revealed ? "Recovery phrase" : "Reveal recovery phrase"}
          style={{ borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(28,27,39,0.9)", padding: 16 }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, opacity: revealed ? 1 : 0.06 }}>
            {words.map((w, i) => (
              <View key={i} style={{ width: "30%", flexGrow: 1, flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" }}>
                <Text variant="label" style={{ color: "#6E6D7C", width: 18 }}>{i + 1}</Text>
                <Text variant="bodyStrong" tone="inverse" selectable={false}>{revealed ? w : "•••••"}</Text>
              </View>
            ))}
          </View>
          {!revealed && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Eye size={26} color="#FFFFFF" />
              <Text variant="bodyStrong" tone="inverse">Tap to reveal</Text>
              <Text variant="caption" style={{ color: "#B8B6C6" }}>Make sure no one is watching your screen</Text>
            </View>
          )}
        </Tap>
      </OnboardingFrame>
    );
  }

  if (step === "confirm") {
    const check = () => {
      const ok = positions.every((p) => (answers[p] ?? "").trim().toLowerCase() === words[p - 1]);
      if (!ok) {
        setConfirmError("One or more words don't match. Check your written copy.");
        return;
      }
      setConfirmError(null);
      setStep("profile");
    };
    return (
      <OnboardingFrame
        step={3}
        total={4}
        title="Confirm your phrase"
        subtitle="Enter the words at these positions to prove you have a copy."
        onBack={() => setStep("phrase")}
        footer={<Button label="Confirm" onPress={check} disabled={positions.some((p) => !answers[p]?.trim())} />}
      >
        {positions.map((p) => (
          <Field
            key={p}
            label={`Word #${p}`}
            value={answers[p] ?? ""}
            onChangeText={(v) => setAnswers((a) => ({ ...a, [p]: v }))}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
          />
        ))}
        {confirmError ? <Text variant="caption" tone="negative" accessibilityLiveRegion="polite">{confirmError}</Text> : null}
      </OnboardingFrame>
    );
  }

  const pwProblems = password ? passwordProblems(password) : [];
  const usernameError = username && !USERNAME_RE.test(username) ? "3–20 characters: lowercase letters, numbers and _" : null;
  const submit = async () => {
    setFormError(null);
    if (pwProblems.length) return setFormError(pwProblems.join(" "));
    if (password !== password2) return setFormError("The passwords don't match.");
    if (usernameError) return setFormError(usernameError);
    setBusy(true);
    try {
      await update({ displayName: displayName.trim(), username: username.trim() });
      await createWallet(mnemonic, password);
      toast("Your wallet is ready", "success");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create the wallet.");
      setBusy(false);
    }
  };

  return (
    <OnboardingFrame
      step={4}
      total={4}
      title="Set up your profile"
      subtitle="Your name is what friends see. The password unlocks HENSENG on this device."
      onBack={() => setStep("confirm")}
      footer={<Button label={busy ? "Encrypting your wallet…" : "Create wallet"} loading={busy} onPress={() => void submit()} disabled={!password || !password2} />}
    >
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="e.g. Ada Lovelace" maxLength={40} />
      <Field
        label="Username"
        value={username}
        onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
        placeholder="ada_builds"
        autoCapitalize="none"
        autoCorrect={false}
        error={usernameError}
        hint="Optional now. You can change it later."
      />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={pwProblems[0] ?? null} hint="At least 8 characters, with letters and numbers." />
      <Field label="Confirm password" value={password2} onChangeText={setPassword2} secureTextEntry autoComplete="new-password" />
      {formError ? <Text variant="caption" tone="negative" accessibilityLiveRegion="polite">{formError}</Text> : null}
    </OnboardingFrame>
  );
}

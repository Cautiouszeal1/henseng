import { Download } from "lucide-react-native";
import { isValidMnemonic, normalizeMnemonic, passwordProblems, unknownWords } from "@henseng/wallet";
import { useState } from "react";
import { OnboardingFrame } from "../ui/onboarding-frame";
import { NoScreenCapture } from "../ui/privacy";
import { useToast } from "../ui/overlays";
import { Button, Field, Text } from "../ui/primitives";
import { useWallet } from "../wallet/wallet-context";

export default function ImportWallet() {
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createWallet } = useWallet();
  const toast = useToast();

  const clean = normalizeMnemonic(phrase);
  const count = clean ? clean.split(" ").length : 0;
  const unknown = clean ? unknownWords(clean) : [];
  const phraseError =
    !clean ? null
    : unknown.length ? `Not a recovery word: ${unknown.slice(0, 3).join(", ")}`
    : count !== 12 && count !== 24 ? `${count} words entered. Phrases have 12 or 24 words.`
    : !isValidMnemonic(clean) ? "The words are valid but the phrase isn't. Check the order."
    : null;

  const submit = async () => {
    setError(null);
    const problems = passwordProblems(password);
    if (phraseError || !clean) return setError(phraseError ?? "Enter your recovery phrase.");
    if (problems.length) return setError(problems.join(" "));
    setBusy(true);
    try {
      await createWallet(clean, password);
      toast("Wallet imported", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setBusy(false);
    }
  };

  return (
    <OnboardingFrame
      title="Import a wallet"
      icon={Download}
      subtitle="Enter the 12 or 24-word recovery phrase from any standard Ethereum wallet."
      footer={<Button label={busy ? "Encrypting…" : "Import wallet"} loading={busy} onPress={() => void submit()} disabled={!clean || !password} />}
    >
      <NoScreenCapture />
      <Field
        label="Recovery phrase"
        value={phrase}
        onChangeText={setPhrase}
        multiline
        numberOfLines={4}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        importantForAutofill="no"
        textContentType="none"
        secureTextEntry={false}
        placeholder="word1 word2 word3 …"
        style={{ minHeight: 120, textAlignVertical: "top" }}
        error={phraseError}
        hint="Typed on this device only. It is encrypted and never uploaded."
      />
      <Field label="New password for this device" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="At least 8 characters, with letters and numbers." />
      {error ? <Text variant="caption" tone="negative" accessibilityLiveRegion="polite">{error}</Text> : null}
    </OnboardingFrame>
  );
}

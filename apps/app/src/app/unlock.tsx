import { attemptsLeft } from "../wallet/unlock-guard";
import { LockKeyhole } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useProfile } from "../profile/profile-context";
import { Avatar } from "../ui/avatar";
import { OnboardingFrame } from "../ui/onboarding-frame";
import { Sheet } from "../ui/overlays";
import { Button, Field, Tap, Text } from "../ui/primitives";
import { DarkScope } from "../ui/theme";
import { useWallet, WrongPasswordError } from "../wallet/wallet-context";

export default function Unlock() {
  const { unlock, removeWallet } = useWallet();
  const { profile, clear } = useProfile();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await unlock(password);
    } catch (e) {
      if (e instanceof WrongPasswordError) {
        const left = await attemptsLeft();
        setError(left > 0 ? `That password is not correct. ${left} ${left === 1 ? "try" : "tries"} left before a short wait.` : "That password is not correct. Wait a moment before trying again.");
      } else setError(e instanceof Error ? e.message : "Could not unlock.");
      setBusy(false);
    }
  };

  return (
    <>
      <OnboardingFrame
        title={profile.displayName ? `Welcome back, ${profile.displayName.split(" ")[0]}` : "Welcome back"}
        subtitle="Enter your password to unlock HENSENG."
        hideBack
        icon={LockKeyhole}
        footer={
          <>
            <Button label={busy ? "Unlocking…" : "Unlock"} loading={busy} disabled={!password} onPress={() => void submit()} />
            <Tap onPress={() => setForgot(true)} accessibilityRole="button" style={{ alignSelf: "center", padding: 8 }}>
              <Text variant="caption" style={{ color: "#B8B6C6" }}>Forgot password?</Text>
            </Tap>
          </>
        }
      >
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <Avatar name={profile.displayName || "HENSENG"} size={88} ring gradientIndex={profile.avatarIndex} />
        </View>
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoFocus onSubmitEditing={() => void submit()} error={error} autoComplete="current-password" />
      </OnboardingFrame>
      <DarkScope>
        <Sheet visible={forgot} onClose={() => setForgot(false)} title="Forgot your password?">
          <Text tone="secondary">
            HENSENG can't reset it: your password only exists on this device. To get back in, remove the wallet from this device and
            import it again with your recovery phrase. Your funds stay safe on the blockchain.
          </Text>
          <Text tone="negative" variant="caption">Without your recovery phrase, removing the wallet means losing access permanently.</Text>
          <Button
            label="Remove wallet from this device"
            kind="danger"
            onPress={async () => {
              await removeWallet();
              await clear();
              setForgot(false);
            }}
          />
          <Button label="Cancel" kind="secondary" onPress={() => setForgot(false)} />
        </Sheet>
      </DarkScope>
    </>
  );
}

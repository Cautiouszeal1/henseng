import { Redirect } from "expo-router";
import { useWallet } from "../wallet/wallet-context";

export default function Index() {
  const { status } = useWallet();
  if (status === "none") return <Redirect href="/welcome" />;
  if (status === "locked") return <Redirect href="/unlock" />;
  return <Redirect href="/chats" />;
}

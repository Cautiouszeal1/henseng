import { ChatsLive } from "../../features/chats-live";
import { ChatsPreview } from "../../features/chats-preview";
import { useMessaging } from "../../messaging/messaging-context";

/** Encrypted XMTP chats when this build enables messaging; labelled preview otherwise. */
export default function ChatsTab() {
  const { status } = useMessaging();
  return status === "off" ? <ChatsPreview /> : <ChatsLive />;
}

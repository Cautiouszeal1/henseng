import { useLocalSearchParams } from "expo-router";
import { MessageCircleOff } from "lucide-react-native";
import { PREVIEW_CHATS } from "../../data/preview";
import { ChatThread } from "../../features/chat-thread";
import { EmptyState } from "../../ui/primitives";
import { Screen } from "../../ui/screen";

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chat = PREVIEW_CHATS.find((c) => c.id === id);
  if (!chat) {
    return (
      <Screen>
        <EmptyState icon={MessageCircleOff} title="Conversation not found" body="It may have been deleted or the link is wrong." />
      </Screen>
    );
  }
  return <ChatThread chat={chat} />;
}

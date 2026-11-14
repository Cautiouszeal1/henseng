import { useLocalSearchParams } from "expo-router";
import { useApi } from "../../api/api-context";
import { CommunityLive } from "../../features/community-live";
import { CommunityPreview } from "../../features/community-preview";

export default function CommunityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useApi();
  return status === "off" ? <CommunityPreview /> : <CommunityLive slug={id} />;
}

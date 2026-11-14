import { useApi } from "../../api/api-context";
import { CommunitiesLive } from "../../features/communities-live";
import { CommunitiesPreview } from "../../features/communities-preview";

/** Live communities when this build is connected to a HENSENG API; labelled preview otherwise. */
export default function CommunitiesTab() {
  const { status } = useApi();
  return status === "off" ? <CommunitiesPreview /> : <CommunitiesLive />;
}

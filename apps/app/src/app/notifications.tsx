import { router } from "expo-router";
import { ArrowLeft, Bell, BellOff, CheckCheck, Megaphone, ShieldCheck } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { useApi, useApiQuery } from "../api/api-context";
import type { AppNotification } from "../api/types";
import { Card, EmptyState, ErrorState, IconButton, Skeleton, Tap, Text } from "../ui/primitives";
import { Screen } from "../ui/screen";
import { useTheme } from "../ui/theme";

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Notifications() {
  const { theme } = useTheme();
  const { status, request, refreshMe } = useApi();
  const { data, error, loading, reload } = useApiQuery<{ notifications: AppNotification[]; unread: number }>(status === "off" ? null : "/notifications");

  // Opening the screen marks everything as read (after showing which were new).
  useEffect(() => {
    if (data?.unread) {
      const t = setTimeout(() => {
        void request("POST", "/notifications/read").then(() => refreshMe());
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [data?.unread, request, refreshMe]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/chats"));

  return (
    <Screen title="Notifications" right={<IconButton icon={ArrowLeft} label="Back" onPress={back} />}>
      {status === "off" ? (
        <EmptyState icon={BellOff} title="Notifications aren't connected" body="This build isn't connected to a HENSENG server, so there's nothing to notify you about yet." />
      ) : error ? (
        <ErrorState title="Couldn't load notifications" body={error} onRetry={() => void reload()} />
      ) : loading && !data ? (
        <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={70} radius={16} />)}</View>
      ) : !data?.notifications.length ? (
        <EmptyState icon={Bell} title="You're all caught up" body="Announcements from your communities, role changes and account alerts will appear here." />
      ) : (
        <Card padded={false}>
          {data.notifications.map((n, i) => {
            const Icon = n.kind === "announcement" ? Megaphone : n.kind === "role" ? ShieldCheck : CheckCheck;
            return (
              <Tap
                key={n.id}
                haptic={false}
                onPress={() => n.link && router.push(n.link as never)}
                accessibilityRole={n.link ? "link" : undefined}
                style={{ flexDirection: "row", gap: 12, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border, backgroundColor: n.readAt ? "transparent" : theme.accentSoft }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} color={theme.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{n.title}</Text>
                  {n.body ? <Text variant="caption" tone="secondary" numberOfLines={2}>{n.body}</Text> : null}
                  <Text variant="label" tone="tertiary">{ago(n.createdAt)}</Text>
                </View>
                {!n.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginTop: 6 }} accessibilityLabel="Unread" /> : null}
              </Tap>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

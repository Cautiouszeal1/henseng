/** Shapes returned by the HENSENG API (/api/v1). */

export type CommunityRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";

export interface Person {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarIndex: number;
  address: string | null;
}

export interface Me extends Person {
  bio: string;
  coverIndex: number;
  showOnline: boolean;
  unreadNotifications: number;
}

export interface CommunityCard {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  visibility: "PUBLIC" | "PRIVATE";
  avatarIndex: number;
  memberCount: number;
  joined: boolean;
  role: CommunityRole | null;
}

export interface Channel {
  id: string;
  name: string;
  kind: "TEXT" | "ANNOUNCEMENTS";
  postRole: CommunityRole;
  canPost: boolean;
}

export interface CommunityDetail extends CommunityCard {
  description: string;
  createdAt: string;
  banned: boolean;
  canManage: boolean;
  channels: Channel[];
  members: (Person & { role: CommunityRole })[];
}

export interface ChannelMessage {
  id: string;
  body: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  replyToId: string | null;
  author: Person & { role: CommunityRole | null };
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Device {
  id: string;
  platform: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

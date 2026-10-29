// Kênh YouTube + các khóa live của kênh. THUẦN (không Firestore) — dùng chung cho giao diện và máy chủ.

/** 1 khóa live (stream key) của kênh. `key` KHÔNG bao giờ gửi nguyên văn ra giao diện (xem ChannelKeyView). */
export interface ChannelKey {
  id: string;
  name: string;
  key: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface Channel {
  id: string;
  name: string;
  url?: string;               // link kênh YouTube (tùy chọn, chỉ để mở nhanh)
  description?: string;
  keys: ChannelKey[];
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface ChannelKeyView extends Omit<ChannelKey, "key"> {
  keyMasked: string;
  usedBy: number;             // số live đang gắn khóa này
}

export interface ChannelView extends Omit<Channel, "keys"> {
  keys: ChannelKeyView[];
  streamCount: number;        // số live gắn kênh này
}

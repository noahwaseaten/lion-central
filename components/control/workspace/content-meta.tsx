import {
  Broadcast,
  CircleDashed,
  CloudSun,
  type Icon,
  Image as ImageIcon,
  Images,
  PaintBucket,
  QrCode,
  TextT,
  Timer,
  VideoCamera,
} from "@phosphor-icons/react";

import type { ContentType } from "@/lib/arc/content";

/**
 * One visual identity per content type — icon + dot color — shared by the zone
 * rail, the stage LEDs, and the inspector so a type always looks the same.
 * Colors are functional: live red for the feed, signal amber for the clock, the
 * category triad for media, muted for off.
 */
export const CONTENT_META: Record<ContentType, { label: string; Icon: Icon; dot: string }> = {
  feed: { label: "Live feed", Icon: Broadcast, dot: "bg-live" },
  clock: { label: "Race clock", Icon: Timer, dot: "bg-signal" },
  text: { label: "Custom text", Icon: TextT, dot: "bg-foreground" },
  sponsors: { label: "Sponsors", Icon: Images, dot: "bg-half" },
  image: { label: "Image", Icon: ImageIcon, dot: "bg-ultra" },
  video: { label: "Video", Icon: VideoCamera, dot: "bg-relay" },
  qr: { label: "QR Code", Icon: QrCode, dot: "bg-foreground" },
  weather: { label: "Weather", Icon: CloudSun, dot: "bg-foreground" },
  color: { label: "Solid color", Icon: PaintBucket, dot: "bg-foreground" },
  off: { label: "Off", Icon: CircleDashed, dot: "bg-muted-foreground" },
};

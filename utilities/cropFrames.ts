// Every surface an uploaded image is shown in, as the crop it applies to it.
// ImageCropDialog previews each frame live and outlines the safe zone (the
// part every frame keeps), so logos and text can be placed where they survive.
export type CropFrame = {
  // i18n key or plain text
  label: string;
  sub?: string;
  aspect: number;
  // object-position y the surface uses, 0 (top) to 1 (bottom)
  focusY?: number;
  // render the preview at this width in px (logos)
  size?: number;
  // a scrimmed background behind text: previewed, but left out of the safe zone
  decorative?: boolean;
};

// Fractions of the image (0–1) a frame keeps under object-fit: cover.
export type FrameRect = { x: number; y: number; w: number; h: number };

export function cropRect(imageAspect: number, frame: CropFrame): FrameRect {
  if (imageAspect > frame.aspect) {
    const w = frame.aspect / imageAspect;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = imageAspect / frame.aspect;
  return { x: 0, y: (1 - h) * (frame.focusY ?? 0.5), w: 1, h };
}

export function safeZone(imageAspect: number, frames: CropFrame[]): FrameRect {
  return frames
    .filter((frame) => !frame.decorative)
    .reduce<FrameRect>(
      (zone, frame) => {
        const r = cropRect(imageAspect, frame);
        const x = Math.max(zone.x, r.x);
        const y = Math.max(zone.y, r.y);
        return {
          x,
          y,
          w: Math.max(0, Math.min(zone.x + zone.w, r.x + r.w) - x),
          h: Math.max(0, Math.min(zone.y + zone.h, r.y + r.h) - y),
        };
      },
      { x: 0, y: 0, w: 1, h: 1 },
    );
}

// Measured from the components that render tournaments.banner.
export const TOURNAMENT_BANNER_FRAMES: CropFrame[] = [
  {
    label: "image_upload.frames.tournament_page",
    sub: "image_upload.frames.desktop",
    aspect: 4,
    focusY: 0.4,
  },
  {
    label: "image_upload.frames.tournament_page",
    sub: "image_upload.frames.phone",
    aspect: 2.5,
    focusY: 0.4,
  },
  { label: "image_upload.frames.live_banner", aspect: 6, focusY: 0.4 },
  { label: "image_upload.frames.cards", aspect: 2 },
  { label: "image_upload.frames.quick_look", aspect: 3 },
  { label: "image_upload.frames.list_thumbnail", aspect: 132 / 76 },
  {
    label: "image_upload.frames.next_lan_strip",
    aspect: 13,
    focusY: 0.4,
    decorative: true,
  },
];

export const EVENT_BANNER_FRAMES: CropFrame[] = [
  { label: "image_upload.frames.event_page", aspect: 3 },
  {
    label: "image_upload.frames.watch_featured",
    aspect: 1100 / 224,
    focusY: 0.4,
  },
  {
    label: "image_upload.frames.events_up_next",
    aspect: 900 / 288,
    focusY: 0.4,
  },
  { label: "image_upload.frames.past_event", aspect: 2 },
  { label: "image_upload.frames.event_card", aspect: 140 / 124 },
  { label: "image_upload.frames.quick_look", aspect: 3 },
  {
    label: "image_upload.frames.up_next_strip",
    aspect: 1100 / 88,
    focusY: 0.4,
    decorative: true,
  },
];

export const LOGO_FRAMES: CropFrame[] = [
  { label: "image_upload.frames.page_header", aspect: 1, size: 72 },
  { label: "image_upload.frames.cards", aspect: 1, size: 36 },
  { label: "image_upload.frames.small", aspect: 1, size: 20 },
];

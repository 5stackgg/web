import { h } from "vue";
import { toast } from "~/components/ui/toast/use-toast";

// Microsoft Store listing for the HEVC Video Extensions. Most Windows
// Chromium browsers can't decode H.265 clips without this installed.
const HEVC_PLUGIN_URL =
  "https://apps.microsoft.com/detail/9nmzlz57r3t7?hl=en-US&gl=US";

let cachedSupport: boolean | null = null;
let warnedThisSession = false;

export function browserSupportsHevc(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  if (typeof document === "undefined") {
    cachedSupport = true;
    return cachedSupport;
  }

  const video = document.createElement("video");
  const canPlay =
    video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
    video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') ||
    video.canPlayType('video/mp4; codecs="hvc1"');
  if (canPlay) {
    cachedSupport = true;
    return cachedSupport;
  }

  const ms = (
    window as unknown as { MediaSource?: { isTypeSupported(t: string): boolean } }
  ).MediaSource;
  if (
    ms &&
    (ms.isTypeSupported('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
      ms.isTypeSupported('video/mp4; codecs="hev1.1.6.L93.B0"'))
  ) {
    cachedSupport = true;
    return cachedSupport;
  }

  cachedSupport = false;
  return cachedSupport;
}

export function notifyMissingHevcOnce(strings: {
  title: string;
  body: string;
  linkLabel: string;
}): void {
  if (warnedThisSession) return;
  warnedThisSession = true;

  toast({
    title: strings.title,
    description: h("span", { class: "select-text break-words" }, [
      `${strings.body} `,
      h(
        "a",
        {
          href: HEVC_PLUGIN_URL,
          target: "_blank",
          rel: "noopener noreferrer",
          class:
            "underline underline-offset-2 font-medium hover:opacity-80",
        },
        strings.linkLabel,
      ),
    ]),
    variant: "destructive",
  });
}

import type { CoursePackage } from "./contracts";

type AuthoredActivity = CoursePackage["units"][number]["lessons"][number]["activities"][number];
/** Translate only media the existing interaction can execute; never silently discard references. */
export function resolveActivityMedia(activity: AuthoredActivity, media: CoursePackage["media"]) {
  const payload = { ...activity.payload };
  const errors: string[] = [];
  if (activity.media?.length) {
    const asset = media.find((item) => item.id === activity.media![0]);
    if (activity.type !== "listening" || activity.media.length !== 1 || asset?.type !== "audio")
      errors.push("Activity media references currently require a listening activity and one known audio asset; other interactions do not present this media.");
    else {
      const inline = payload.media as { kind?: string; url?: string } | undefined;
      if (inline && (inline.kind !== "audio" || inline.url !== asset.src))
        errors.push("Inline audio and authored media reference conflict.");
      else payload.media = { kind: "audio", url: asset.src };
    }
  }
  return { payload, errors };
}

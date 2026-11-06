import { staticAsset } from "../utils/staticAsset";
import { useEffect, useState } from "react";
import type { Track } from "../types/track";
import { readFile } from "../utils/storage";
import { embeddedArtwork, coverGradient } from "../utils/artwork";

/** URLs belong to this mounted cover and are always revoked; no audio buffers retained. */
export function TrackArtwork({
  track,
  ambient = false,
}: {
  track: Track;
  ambient?: boolean;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let disposed = false,
      objectUrl: string | undefined;
    setUrl(track.coverUrl?.startsWith("/demo/") ? staticAsset(track.coverUrl) : track.coverUrl);
    if (track.coverUrl) return;
    void readFile(track.id)
      .then(embeddedArtwork)
      .then((blob) => {
        if (disposed || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [track.id, track.coverUrl]);
  return (
    <div
      aria-hidden="true"
      className={ambient ? "track-ambient" : "track-art artwork"}
      style={{ background: coverGradient(track.id) }}
    >
      {url ? (
        <img src={url} alt="" onError={() => setUrl(undefined)} />
      ) : (
        <span className="artwork-orbit" />
      )}
    </div>
  );
}

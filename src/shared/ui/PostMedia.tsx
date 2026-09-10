import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { View } from "react-native";

import { getSafeMediaUri, isVideoUri } from "../utils/media-uri";

export interface PostMediaProps {
    uris: string[];
    /**
     * Set inside a quoted card, which is a link to the original rather than
     * something to operate. A video there loses its controls: play, seek and
     * fullscreen would put their own tap targets over a card whose whole job
     * is to be pressed.
     */
    isEmbedded?: boolean;
}

const FILL = { width: "100%", height: "100%" } as const;

/**
 * A post's attachments, as the web lays them out: one fills the card at 16:9,
 * two or more tile into a square grid two across.
 *
 * The gap between tiles is drawn by the container showing through a one-pixel
 * inset on each cell rather than by `gap`. With `flex-wrap` and cells at half
 * width, a gap is subtracted from the row *after* the halves are computed, so
 * the second tile wraps to its own line and the grid becomes a column.
 */
export function PostMedia({ uris, isEmbedded = false }: PostMediaProps) {
    const safe = uris
        .map((uri) => getSafeMediaUri(uri))
        .filter((uri): uri is string => uri !== null);

    if (safe.length === 0) return null;

    const isSingle = safe.length === 1;

    return (
        <View className="flex-row flex-wrap overflow-hidden rounded-2xl border border-ink/10 bg-surface-2">
            {safe.map((uri) => (
                <View
                    key={uri}
                    className={
                        isSingle
                            ? "aspect-video w-full"
                            : "aspect-square w-1/2 p-px"
                    }
                >
                    {isVideoUri(uri) ? (
                        <PostVideo uri={uri} isEmbedded={isEmbedded} />
                    ) : (
                        <Image
                            source={{ uri }}
                            style={FILL}
                            contentFit="cover"
                            transition={150}
                            // Rows recycle as the feed scrolls; without this a
                            // tile keeps the previous post's picture until the
                            // next one decodes.
                            recyclingKey={uri}
                        />
                    )}
                </View>
            ))}
        </View>
    );
}

/**
 * One video, with the platform's own controls and nothing playing on its own.
 *
 * Autoplay is what a feed of twenty clips would do to somebody's battery and
 * data, and it is not what the web does either — it renders a `<video controls>`
 * and waits to be asked.
 */
function PostVideo({ uri, isEmbedded }: { uri: string; isEmbedded: boolean }) {
    const player = useVideoPlayer(uri, (instance) => {
        instance.loop = false;
        // Muted so a video that is somehow started cannot talk over whatever
        // the phone is already playing.
        instance.muted = true;
    });

    return (
        <VideoView
            player={player}
            style={FILL}
            contentFit="cover"
            nativeControls={!isEmbedded}
            // Fullscreen is the only way to watch a clip that is 16:9 inside a
            // half-width tile. Picture-in-picture is not: it would leave a
            // video floating over the app after the reader has scrolled past
            // the post it belongs to.
            fullscreenOptions={{ enable: !isEmbedded }}
            allowsPictureInPicture={false}
        />
    );
}

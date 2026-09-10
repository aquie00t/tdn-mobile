import { useLocalSearchParams } from "expo-router";

import { CommentThreadScreen } from "../../features/comment/ui/screens/CommentThreadScreen";

/**
 * A comment's own thread. Thin, unlike `post/[id].tsx`: that screen has to
 * compose two features and this one reaches only into `comment`.
 */
export default function CommentRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <CommentThreadScreen commentId={id} />;
}

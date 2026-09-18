import { useLocalSearchParams } from "expo-router";

import { ArticleScreen } from "@features/article/ui/screens/ArticleScreen";
import { CommentList } from "@features/comment/ui/components/CommentList";

/**
 * One article and its thread.
 *
 * **Composed in the route**, like the post detail screen: the article is the
 * article feature's and the thread is the comment feature's, and neither may
 * import the other. `CommentList` owns the scrolling and takes the article as
 * its header, so the page and its comments move as one.
 */
export default function ArticleRoute() {
    const { slug } = useLocalSearchParams<{ slug: string }>();

    return (
        <ArticleScreen
            slug={slug}
            renderComments={({
                article,
                header,
                onCommentCreated,
                canComment,
            }) => (
                <CommentList
                    target={{ type: "article", id: article.id }}
                    header={header}
                    onCommentCreated={onCommentCreated}
                    canComment={canComment}
                />
            )}
        />
    );
}

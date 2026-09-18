import { ArticleList } from "@features/article/ui/components/ArticleList";
import { FeedScreen } from "@features/feed/ui/screens/FeedScreen";

/**
 * The feed, with the articles tab filled in.
 *
 * **Composed in the route**, like the profile screen and the saved list. The
 * strip and the post lists are the feed feature's and the article list is the
 * article feature's — a feature may not import another, and a route may import
 * both. The web keeps articles in the same strip for the same reason: they are
 * the fourth thing somebody might be reading, and a phone's bar has no room
 * for a sixth tab.
 */
export default function FeedRoute() {
    return <FeedScreen articles={<ArticleList />} />;
}

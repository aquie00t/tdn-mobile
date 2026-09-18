import { ArticleEditorScreen } from "@features/article/ui/screens/ArticleEditorScreen";

/**
 * A new article.
 *
 * A static segment beside `[slug]`, and the router ranks it first — so an
 * article whose slug is literally `new` could not be read at its own address.
 * The server derives slugs from titles, so that is an article titled "New" and
 * nothing more; the web accepts the same trade.
 */
export default function NewArticleRoute() {
    return <ArticleEditorScreen />;
}

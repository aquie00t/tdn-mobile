import { useLocalSearchParams } from "expo-router";

import { ArticleEditorScreen } from "@features/article/ui/screens/ArticleEditorScreen";

export default function EditArticleRoute() {
    const { slug } = useLocalSearchParams<{ slug: string }>();

    return <ArticleEditorScreen slug={slug} />;
}

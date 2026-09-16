import { useLocalSearchParams } from "expo-router";

import { ArticleScreen } from "@features/article/ui/screens/ArticleScreen";

export default function ArticleRoute() {
    const { slug } = useLocalSearchParams<{ slug: string }>();

    return <ArticleScreen slug={slug} />;
}

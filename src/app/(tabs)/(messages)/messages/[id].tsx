import { useLocalSearchParams } from "expo-router";

import { ThreadScreen } from "@features/message/ui/screens/ThreadScreen";

export default function ThreadRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();

    return <ThreadScreen conversationId={id} />;
}

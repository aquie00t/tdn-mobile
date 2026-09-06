import { Text, View } from "react-native";

export default function IndexScreen() {
    return (
        <View className="flex-1 items-center justify-center bg-ground">
            <Text className="text-2xl font-semibold text-ink">TDN</Text>
            <Text className="mt-2 text-sm text-ink/60">
                The Developer Network
            </Text>
        </View>
    );
}

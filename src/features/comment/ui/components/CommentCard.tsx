import { Pressable, View } from "react-native";
import { memo } from "react";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import {
    BookmarkIcon,
    CommentIcon,
    LikeIcon,
    ShareIcon,
} from "@shared/ui/icons/lucide";
import type { Comment } from "../../data/comment.types";
import type { LucideIcon } from "lucide-react-native";
import { RichText } from "@shared/ui/RichText";
import { Text } from "@shared/ui/Text";
import { useCommentActions } from "../hooks/useCommentActions";
import { useCommentOverlayStore } from "../store/comment-overlay.store";
import { useI18n } from "@shared/hooks/useI18n";
import { withOverlay } from "@shared/store/create-overlay-store";

export interface CommentCardProps {
    comment: Comment;
    /**
     * Off where the card is already the head of the screen it is on — a
     * comment that opens its own thread from inside that thread would go
     * nowhere.
     */
    isPressable?: boolean;
    /**
     * The subject of the screen it is on, rather than a row in a list.
     *
     * Drawn at the post card's weight — a bigger face, body text instead of
     * the list's small — because a screen whose head looks like one of its own
     * rows does not say what it is about. The web draws both the same and gets
     * away with it: a page has a title bar, three columns and a URL saying
     * where you are, none of which a phone has.
     */
    isHead?: boolean;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatCommentDate(iso: string, locale: string): string {
    let formatter = formatters.get(locale);

    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
        });
        formatters.set(locale, formatter);
    }

    return formatter.format(new Date(iso));
}

/**
 * One comment.
 *
 * **Pressing it opens its own thread**, and that is the whole shape of nesting
 * here: a comment is not expanded in place, it becomes the head of a screen
 * where its replies are the list and the composer writes into it. Replying to
 * a reply is the same move again, one screen deeper.
 *
 * An earlier draft expanded replies inline under the card and capped the depth
 * at one. Both were inventions. The API caps nothing — `create-comment` only
 * checks that a parent belongs to the same post — and the web has carried the
 * per-comment screen from the start.
 */
function CommentCardView({
    comment: serverComment,
    isPressable = true,
    isHead = false,
}: CommentCardProps) {
    const { t, locale } = useI18n();
    const router = useRouter();

    const overlays = useCommentOverlayStore((s) => s.overlays);
    const comment = withOverlay(serverComment, overlays);

    const { handleLike, isLikeLoading, handleBookmark, handleShare } =
        useCommentActions({ comment });

    const open = () =>
        router.push({
            pathname: "/comments/[id]",
            params: { id: comment.id },
        });

    const Row = isPressable ? Pressable : View;

    return (
        <Row
            // Nested pressables: a tap on one of the controls below is handled
            // there and never reaches this one, so the row can open the thread
            // without swallowing a like.
            {...(isPressable
                ? { accessibilityRole: "button" as const, onPress: open }
                : {})}
            className={
                isHead ? "px-4 pb-3 pt-4" : "border-b border-ink/5 px-4 py-3"
            }
        >
            <View className="flex-row gap-3">
                <Avatar
                    uri={comment.author.avatarUrl}
                    size={isHead ? 40 : 32}
                />

                <View className="flex-1 gap-1.5">
                    <View className="flex-row items-center gap-1.5">
                        {comment.author.fullName && (
                            <Text
                                size="small"
                                numberOfLines={1}
                                className="shrink font-semibold"
                            >
                                {comment.author.fullName}
                            </Text>
                        )}
                        <Text
                            size="small"
                            tone="subtle"
                            numberOfLines={1}
                            className="shrink"
                        >
                            @{comment.author.username}
                        </Text>

                        {/* The head carries the full stamp below instead. */}
                        {!isHead && (
                            <>
                                <Text size="small" tone="subtle">
                                    ·
                                </Text>
                                <Text size="small" tone="subtle">
                                    {formatCommentDate(
                                        comment.createdAt,
                                        locale,
                                    )}
                                </Text>
                            </>
                        )}
                    </View>

                    <RichText
                        text={comment.content}
                        size={isHead ? "body" : "small"}
                    />

                    <View
                        className={
                            isHead
                                ? "flex-row items-center gap-6 pt-1"
                                : "flex-row items-center gap-5 pt-0.5"
                        }
                    >
                        <Action
                            icon={CommentIcon}
                            size={isHead ? 16 : 14}
                            count={comment.replyCount}
                            isActive={false}
                            disabled={!isPressable}
                            label={t("commentBox.reply")}
                            onPress={open}
                        />

                        <Action
                            icon={LikeIcon}
                            size={isHead ? 16 : 14}
                            count={comment.likeCount}
                            isActive={comment.isLiked}
                            activeClassName="text-like"
                            disabled={isLikeLoading}
                            label={t("post.like")}
                            onPress={() => void handleLike()}
                        />

                        <Action
                            icon={BookmarkIcon}
                            size={isHead ? 16 : 14}
                            isActive={comment.isBookmarked}
                            activeClassName="text-accent"
                            label={t("post.bookmark")}
                            onPress={() => void handleBookmark()}
                        />

                        <Action
                            icon={ShareIcon}
                            size={isHead ? 16 : 14}
                            isActive={false}
                            label={t("post.share")}
                            onPress={() => void handleShare()}
                        />
                    </View>
                </View>
            </View>
        </Row>
    );
}

/** Rows are recycled by the list above; a comment changes only when it does. */
export const CommentCard = memo(CommentCardView);

/**
 * One control, and the number beside it when there is one. The post card's
 * `Action` at a smaller size — same rules, same roles.
 */
function Action({
    icon: Icon,
    count,
    isActive,
    activeClassName = "text-ink",
    disabled,
    label,
    size = 14,
    onPress,
}: {
    icon: LucideIcon;
    count?: number;
    isActive: boolean;
    activeClassName?: string;
    disabled?: boolean;
    label: string;
    size?: number;
    onPress: () => void;
}) {
    const tone = isActive ? activeClassName : "text-ink/40";

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: !!disabled }}
            accessibilityLabel={label}
            disabled={disabled}
            onPress={onPress}
            hitSlop={8}
            className="flex-row items-center gap-1.5"
        >
            <Icon
                size={size}
                className={tone}
                fill={isActive ? "currentColor" : "none"}
            />
            {count !== undefined && (
                <Text size="caption" tone="subtle" className={tone}>
                    {count}
                </Text>
            )}
        </Pressable>
    );
}

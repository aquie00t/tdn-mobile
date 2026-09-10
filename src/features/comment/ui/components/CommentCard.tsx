import { Pressable, View } from "react-native";
import { memo, useState } from "react";

import { Avatar } from "@shared/ui/Avatar";
import {
    BookmarkIcon,
    CommentIcon,
    LikeIcon,
    ShareIcon,
} from "@shared/ui/icons/lucide";
import { CommentBox } from "./CommentBox";
import type { Comment, CommentTarget } from "../../data/comment.types";
import { ErrorState } from "@shared/ui/ErrorState";
import type { LucideIcon } from "lucide-react-native";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useCommentActions } from "../hooks/useCommentActions";
import { useCommentOverlayStore } from "../store/comment-overlay.store";
import { useCommentReplies } from "../hooks/useCommentReplies";
import { useI18n } from "@shared/hooks/useI18n";
import { withOverlay } from "@shared/store/create-overlay-store";

export interface CommentCardProps {
    comment: Comment;
    /** Needed to post a reply — a reply hangs off the same target. */
    target: CommentTarget;
    /**
     * Off for a reply. Replies are one level deep: the API has no route for a
     * reply's replies, so a nested card must not offer to open — or add to —
     * a thread that cannot exist.
     */
    canReply?: boolean;
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

function CommentCardView({
    comment: serverComment,
    target,
    canReply = true,
}: CommentCardProps) {
    const { t, locale } = useI18n();

    const overlays = useCommentOverlayStore((s) => s.overlays);
    const comment = withOverlay(serverComment, overlays);

    const [isExpanded, setIsExpanded] = useState(false);
    const [isReplying, setIsReplying] = useState(false);

    const { handleLike, isLikeLoading, handleBookmark, handleShare } =
        useCommentActions({ comment });

    const {
        replies,
        isLoading,
        error,
        fetchReplies,
        hasMore,
        isLoadingMore,
        loadMore,
        addReply,
    } = useCommentReplies(comment.id);

    /**
     * Replies are read when somebody asks for them, not when the thread
     * renders. A screen of twenty comments would otherwise make twenty
     * requests before the reader has decided to open any of them.
     */
    const expand = () => {
        setIsExpanded(true);
        if (replies.length === 0) void fetchReplies();
    };

    const handleToggle = () => {
        if (isExpanded) setIsExpanded(false);
        else expand();
    };

    /**
     * A reply is posted into a thread that may not be open yet, so opening it
     * is part of starting to write one — otherwise the reply lands somewhere
     * the author cannot see.
     */
    const handleStartReply = () => {
        setIsReplying(true);
        if (!isExpanded) expand();
    };

    return (
        <View className="border-b border-ink/5 px-4 py-3">
            <View className="flex-row gap-3">
                <Avatar uri={comment.author.avatarUrl} size={32} />

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
                        <Text size="small" tone="subtle">
                            ·
                        </Text>
                        <Text size="small" tone="subtle">
                            {formatCommentDate(comment.createdAt, locale)}
                        </Text>
                    </View>

                    <Text size="small">{comment.content}</Text>

                    <View className="flex-row items-center gap-5 pt-0.5">
                        <Action
                            icon={LikeIcon}
                            count={comment.likeCount}
                            isActive={comment.isLiked}
                            activeClassName="text-like"
                            disabled={isLikeLoading}
                            label={t("post.like")}
                            onPress={() => void handleLike()}
                        />

                        {canReply ? (
                            <Action
                                icon={CommentIcon}
                                count={comment.replyCount}
                                isActive={isExpanded}
                                activeClassName="text-ink"
                                label={t("commentBox.reply")}
                                onPress={handleToggle}
                            />
                        ) : (
                            <Action
                                icon={CommentIcon}
                                count={comment.replyCount}
                                isActive={false}
                                disabled
                                label={t("commentBox.reply")}
                                onPress={() => {}}
                            />
                        )}

                        <Action
                            icon={BookmarkIcon}
                            isActive={comment.isBookmarked}
                            activeClassName="text-accent"
                            label={t("post.bookmark")}
                            onPress={() => void handleBookmark()}
                        />

                        <Action
                            icon={ShareIcon}
                            isActive={false}
                            label={t("post.share")}
                            onPress={() => void handleShare()}
                        />

                        {canReply && !isReplying && (
                            <Pressable
                                accessibilityRole="button"
                                onPress={handleStartReply}
                                hitSlop={8}
                                className="ml-auto"
                            >
                                <Text size="caption" tone="accent">
                                    {t("commentBox.reply")}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>

            {isReplying && (
                <View className="mt-2 pl-11">
                    <CommentBox
                        target={target}
                        parentId={comment.id}
                        placeholder={t("commentBox.placeholder")}
                        isInline
                        onCommentCreated={(reply) => {
                            addReply(reply);
                            setIsReplying(false);
                        }}
                    />
                </View>
            )}

            {isExpanded && (
                <View className="mt-2 gap-1 border-l border-ink/10 pl-5">
                    {isLoading && <Spinner />}

                    {error && !isLoading && (
                        <ErrorState message={error} onRetry={fetchReplies} />
                    )}

                    {replies.map((reply) => (
                        <CommentCard
                            key={reply.id}
                            comment={reply}
                            target={target}
                            canReply={false}
                        />
                    ))}

                    {hasMore && !isLoading && (
                        <Pressable
                            accessibilityRole="button"
                            disabled={isLoadingMore}
                            onPress={() => void loadMore()}
                            className="py-2"
                        >
                            <Text size="caption" tone="accent">
                                {isLoadingMore
                                    ? t("common.loadingMore")
                                    : t("common.loadMore")}
                            </Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
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
    onPress,
}: {
    icon: LucideIcon;
    count?: number;
    isActive: boolean;
    activeClassName?: string;
    disabled?: boolean;
    label: string;
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
                size={14}
                className={tone}
                fill={
                    isActive && activeClassName !== "text-ink"
                        ? "currentColor"
                        : "none"
                }
            />
            {count !== undefined && (
                <Text size="caption" tone="subtle" className={tone}>
                    {count}
                </Text>
            )}
        </Pressable>
    );
}

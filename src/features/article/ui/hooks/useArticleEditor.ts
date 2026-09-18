import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { articleApi } from "../../data/article.api";
import type { Article, ArticleStatus } from "../../data/article.types";
import { createArticleSender, toUpdateBody } from "../../data/article-save";
import type { CoverChange } from "../../data/article-save";
import { EMPTY_DRAFT, checkDraft, isBlankDraft } from "../../domain/draft";
import type { ArticleDraft, DraftProblem } from "../../domain/draft";
import {
    MEDIA_ERROR_TITLES,
    clearsSelection,
    isMediaError,
} from "@shared/utils/media-errors";
import { getErrorMessage, isOurFailure } from "@shared/utils/error-handler";
import { newIdempotencyKey } from "@core/api/idempotency";
import type { PickedAsset } from "@shared/utils/asset-to-form";
import { platform } from "@core/platform";
import { reportError } from "@shared/utils/report-error";
import { useArticleRevisionStore } from "../store/article-revision.store";

/**
 * Quiet time before an autosave fires. Creation is five a minute and updates
 * sixty, so two seconds sits comfortably inside both even for somebody typing
 * in short bursts — and only the pause at the end of a burst reaches the
 * network, because the timer restarts on every edit.
 */
const AUTOSAVE_DELAY_MS = 2000;

export type SaveState = "idle" | "saving" | "saved" | "error";

const draftOf = (article: Article): ArticleDraft => ({
    title: article.title,
    body: article.body,
    excerpt: article.excerpt ?? "",
    coverAlt: article.coverImageAlt ?? "",
    tags: article.tags.map((tag) => tag.name),
    categories: article.categories,
});

/**
 * Writing one article: the form, autosave, the cover, and the three moves out
 * of a draft.
 *
 * Ported from the web's hook, whose comments carry most of the reasoning — the
 * follow-up save for text typed mid-request, the cover uploaded once per file,
 * the dropped cache after `MediaNotOwnedError`. Three things are added here:
 *
 * - **The create is idempotent**, which the web's is not. See
 *   `createArticleSender`: a timed-out create is repeated as it was, under the
 *   same key, rather than rebuilt from the text that has changed since.
 * - **Backgrounding saves.** The web asks the browser to warn before a tab
 *   closes; an app gets no such moment, and Android may end a backgrounded
 *   process without another word. So the debounce is skipped when the app
 *   leaves the screen.
 * - **Leaving saves.** Back is usually not a question: whatever is
 *   outstanding is sent as the screen closes, and a failure then goes to
 *   `reportError`, like any other background write whose screen has gone. The
 *   one exception is writing that *cannot* be sent — no title yet, or over a
 *   limit — which `leave` hands back to the screen to ask about.
 *
 * And one rule is ours: **the writer is not shown our errors.** A save that
 * failed on the network or a 5xx says "could not save" and offers a retry; the
 * reason goes to `reportError`. What is shown in words is the server's answer
 * — a refused cover, a rate limit — because the writer has to act on it.
 *
 * @param initial - The article being edited, or `null` for a new one. Read
 * once, on mount; the screen keys the editor by id so a different article
 * remounts it rather than inheriting this one's state.
 */
export function useArticleEditor(initial: Article | null) {
    const [draft, setDraft] = useState<ArticleDraft>(() =>
        initial ? draftOf(initial) : EMPTY_DRAFT,
    );
    const [articleId, setArticleId] = useState<string | null>(
        initial?.id ?? null,
    );
    const [slug, setSlug] = useState<string | null>(initial?.slug ?? null);
    const [status, setStatus] = useState<ArticleStatus | null>(
        initial?.status ?? null,
    );
    const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(
        initial?.coverImageUrl ?? null,
    );
    /** Chosen but not yet sent. It is uploaded by the save that needs it. */
    const [coverAsset, setCoverAsset] = useState<PickedAsset | null>(null);
    /** Set when the writer takes off a cover the article already had. */
    const [coverRemoved, setCoverRemoved] = useState(false);

    const [saveState, setSaveState] = useState<SaveState>(
        initial ? "saved" : "idle",
    );
    /**
     * The server's answer, when it is one to act on. Our own failures leave
     * this `null` and the indicator says only that the save did not happen.
     */
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    /**
     * What the server last accepted, so an autosave with nothing new to say
     * does not fire. State rather than a ref because `isDirty` is computed
     * during render.
     */
    const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
        initial ? JSON.stringify(draftOf(initial)) : "",
    );

    /**
     * The upload endpoint allows five a minute, so a cover goes up once per
     * chosen file and its key is reused by every later save. Without this, an
     * article with a cover spends the minute's budget in three pauses.
     */
    const uploadedCoverRef = useRef<{ asset: PickedAsset; key: string } | null>(
        null,
    );
    /** One per editor, so a create in doubt is held across every retry. */
    const [sender] = useState(() => createArticleSender(newIdempotencyKey));
    const bumpRevision = useArticleRevisionStore((s) => s.bump);

    const isSavingRef = useRef(false);
    /** The save chain running now, which a second caller waits on. */
    const chainRef = useRef<Promise<Article | null> | null>(null);
    /** Set when an edit arrives mid-save; cleared by the follow-up save. */
    const resaveRef = useRef(false);
    /** Set once the article is deleted, so leaving does not save it again. */
    const isClosedRef = useRef(false);
    const articleIdRef = useRef<string | null>(initial?.id ?? null);
    const draftRef = useRef(draft);
    const coverAssetRef = useRef<PickedAsset | null>(null);
    const coverRemovedRef = useRef(false);
    /**
     * The form as the server last accepted it — `savedSnapshot`, but readable
     * outside a render, where the chain and the leaving flush need it.
     */
    const lastSentRef = useRef(initial ? JSON.stringify(draftOf(initial)) : "");

    /**
     * Whether anything on screen has not reached the server. Read from refs
     * so it is true *now*, not as of the last render: asked twice on the way
     * out — once as the pop starts, once as the screen unmounts — the second
     * asking must see what the first one sent.
     */
    const hasOutstanding = useCallback(
        () =>
            JSON.stringify(draftRef.current) !== lastSentRef.current ||
            coverAssetRef.current !== null ||
            coverRemovedRef.current,
        [],
    );

    useEffect(() => {
        coverAssetRef.current = coverAsset;
    }, [coverAsset]);
    useEffect(() => {
        coverRemovedRef.current = coverRemoved;
    }, [coverRemoved]);

    /**
     * The one way the form changes. The ref is written here, synchronously,
     * rather than after the render: publish is tapped straight after the
     * screen commits a half-typed tag, and a ref that caught up a render later
     * would send the article without it.
     */
    const update = useCallback(
        <K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) => {
            const next = { ...draftRef.current, [key]: value };
            draftRef.current = next;
            setDraft(next);
        },
        [],
    );

    // Serialised once per change and reused: the dirty check and the byte
    // check both need it, and it runs over the whole body.
    const serialised = useMemo(() => JSON.stringify(draft), [draft]);
    const problem: DraftProblem | null = useMemo(
        () => checkDraft(draft, serialised),
        [draft, serialised],
    );
    const canSave = problem === null;

    const resolveCover = useCallback(async (): Promise<CoverChange> => {
        const asset = coverAssetRef.current;
        if (asset) {
            if (uploadedCoverRef.current?.asset === asset) {
                return uploadedCoverRef.current;
            }
            try {
                const { coverImageKey } = await articleApi.uploadCover(asset);
                uploadedCoverRef.current = { asset, key: coverImageKey };
                return uploadedCoverRef.current;
            } catch (err) {
                /*
                 * A verdict on the file — refused, too large, not an image —
                 * makes it useless, and kept it would be uploaded and refused
                 * again at every pause. Checked here rather than around the
                 * whole save, because the same titles can come back from the
                 * article itself: a 413 on the body says nothing about the
                 * picture. The sentence in the header says why it went.
                 */
                if (clearsSelection(err)) {
                    coverAssetRef.current = null;
                    setCoverAsset(null);
                }
                throw err;
            }
        }
        // `null` erases the cover, `undefined` leaves it alone.
        return coverRemovedRef.current ? null : undefined;
    }, []);

    /**
     * Brings the cover state in line with what the server now holds.
     *
     * Compared against what is on screen *now* rather than assumed, because
     * the writer can change the cover while a save is in flight: a file sent
     * and then replaced stays as the next save's work, and one sent and then
     * taken off becomes a removal.
     *
     * @returns Whether the cover still owes a save — which the caller has to
     * run itself, because nothing the autosave timer watches has changed.
     */
    const settleCover = useCallback(
        (sent: CoverChange, article: Article): boolean => {
            if (sent === undefined) return false;

            if (sent === null) {
                coverRemovedRef.current = false;
                setCoverRemoved(false);
                return false;
            }

            /*
             * A new cover replaces whatever was there, so a removal still pending
             * — the old cover taken off, this one picked in its place — has been
             * answered by it. Left set, the next save would erase the new cover.
             */
            const onScreen = coverAssetRef.current;
            if (onScreen === sent.asset) {
                setExistingCoverUrl(article.coverImageUrl);
                coverAssetRef.current = null;
                setCoverAsset(null);
                coverRemovedRef.current = false;
                setCoverRemoved(false);
                return false;
            }
            if (onScreen === null) {
                setExistingCoverUrl(null);
                coverRemovedRef.current = true;
                setCoverRemoved(true);
                return true;
            }
            setExistingCoverUrl(article.coverImageUrl);
            coverRemovedRef.current = false;
            setCoverRemoved(false);
            return true;
        },
        [],
    );

    const save = useCallback(async (): Promise<Article | null> => {
        const current = draftRef.current;
        // Re-checked rather than trusted from the caller: `save` is also
        // reached from the retry control, from publish and from leaving.
        if (checkDraft(current, JSON.stringify(current)) !== null) return null;

        // A save already running captured an older draft. Rather than drop
        // this one, mark that another is owed; `saveChain` picks it up.
        if (isSavingRef.current) {
            resaveRef.current = true;
            return null;
        }

        isSavingRef.current = true;
        setSaveState("saving");
        setSaveError(null);

        try {
            let article: Article;
            let sentDraft: ArticleDraft;
            let sentCover: CoverChange;

            if (articleIdRef.current) {
                sentCover = await resolveCover();
                article = await articleApi.updateArticle(
                    articleIdRef.current,
                    toUpdateBody(current, sentCover),
                );
                sentDraft = current;
            } else {
                /*
                 * A create in doubt is repeated whole, its cover included, so
                 * nothing is resolved for it: uploading the file on screen
                 * would spend one of five uploads on a key the frozen body
                 * never mentions.
                 */
                const cover = sender.isHolding()
                    ? undefined
                    : await resolveCover();
                const result = await sender.send(current, cover);
                article = result.article;
                sentDraft = result.sent.draft;
                sentCover = result.sent.cover;

                articleIdRef.current = article.id;
                setArticleId(article.id);
                setSlug(article.slug);
                setStatus(article.status);
            }

            // What was *sent*, which after a repeated create can be older
            // than the screen.
            lastSentRef.current = JSON.stringify(sentDraft);
            setSavedSnapshot(lastSentRef.current);
            const coverOwed = settleCover(sentCover, article);

            /*
             * Work this save left behind that no timer will come back for:
             * text typed while a create was in doubt — the repeat carried the
             * first attempt's form, not the screen — or a cover changed while
             * the request was out. The autosave effect is keyed on edits, and
             * none has happened since, so the chain has to run it.
             */
            if (sentDraft !== current || coverOwed) resaveRef.current = true;

            bumpRevision(article.id);
            setSaveState("saved");
            return article;
        } catch (err) {
            /*
             * An upload belongs to one article, and the key is cached so a
             * retry does not spend a second upload. Those two come apart when
             * a request timed out after the server wrote it: the article owns
             * the key, and every retry re-sends it and is refused. Dropping
             * the cache turns a locked editor into one more upload.
             */
            if (isMediaError(err, MEDIA_ERROR_TITLES.notOwned)) {
                uploadedCoverRef.current = null;
            }
            reportError("article.save", err);
            const message = getErrorMessage(err);
            setSaveError(isOurFailure(message) ? null : message);
            setSaveState("error");
            return null;
        } finally {
            isSavingRef.current = false;
        }
    }, [bumpRevision, resolveCover, sender, settleCover]);

    /**
     * Runs the save, then again for as long as more is owed — text typed while
     * a request was out, or work a save left behind. The autosave effect will
     * not re-fire for either on its own, so without this the newer text is
     * never sent.
     *
     * **One chain at a time, and a second caller joins it.** Asked while one
     * is running, this marks another save owed and hands back the running
     * chain, which sends it before it resolves. That is what publish needs:
     * tapped while an autosave is out — two seconds after typing stops, which
     * is exactly when people tap it — it waits for the text on screen to be
     * saved rather than finding a save in progress and quietly doing nothing.
     *
     * The last result is returned as-is: a follow-up that failed must not read
     * as success, or publish would go ahead with text behind the screen.
     */
    const saveChain = useCallback((): Promise<Article | null> => {
        if (chainRef.current) {
            resaveRef.current = true;
            return chainRef.current;
        }

        const run = (async () => {
            try {
                let result = await save();
                while (result && resaveRef.current && hasOutstanding()) {
                    resaveRef.current = false;
                    // In order, deliberately: each save sends what the one
                    // before it left, and two in parallel would race.
                    // eslint-disable-next-line no-await-in-loop
                    result = await save();
                }
                return result;
            } finally {
                resaveRef.current = false;
                chainRef.current = null;
            }
        })();
        chainRef.current = run;
        return run;
        /*
         * `memo-dependencies` reads these as extra because both only reach
         * refs; `exhaustive-deps` demands them because they are callbacks
         * declared in the component. The two cannot both be satisfied, and
         * listing them is the one that is right if either ever reads state.
         */
        // eslint-disable-next-line react/memo-dependencies
    }, [hasOutstanding, save]);

    const isDirty =
        serialised !== savedSnapshot || coverAsset !== null || coverRemoved;

    /*
     * `exhaustive-effect-dependencies` calls the first three extra, and they
     * are the point: the body never reads them, but each edit has to restart
     * the timer, so that only the pause at the end of a burst saves. Keyed on
     * `isDirty` alone, the timer would start at the first keystroke and fire
     * two seconds later mid-sentence, however fast the writer was typing.
     */
    useEffect(() => {
        if (!canSave || !isDirty || isBusy) return;
        const timer = setTimeout(() => {
            void saveChain();
        }, AUTOSAVE_DELAY_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react/exhaustive-effect-dependencies
    }, [draft, coverAsset, coverRemoved, canSave, isDirty, isBusy, saveChain]);

    /**
     * Whether leaving now would lose writing: there is some, it differs from
     * what the server has, and it cannot be sent — no title yet, or over a
     * limit. An untouched new article is not work to lose, and one that can
     * simply be saved on the way out is not lost.
     */
    const hasUnsendableWork =
        !canSave && serialised !== savedSnapshot && !isBlankDraft(draft);

    /**
     * Sends whatever is outstanding, now. Held in a ref so the listeners
     * below — which subscribe once — always reach the current values.
     */
    const flushRef = useRef<() => void>(() => {});
    const unsendableRef = useRef(false);
    useEffect(() => {
        unsendableRef.current = hasUnsendableWork;
        flushRef.current = () => {
            if (isClosedRef.current) return;
            if (canSave && hasOutstanding()) void saveChain();
        };
    });

    useEffect(
        () =>
            platform.appState.subscribe((isForeground) => {
                if (!isForeground) flushRef.current();
            }),
        [],
    );

    // The fallback for a screen removed without `leave` being asked first.
    useEffect(() => () => flushRef.current(), []);

    /**
     * What the screen asks before it goes.
     *
     * `"confirm"` when leaving would lose writing that cannot be saved — the
     * screen puts that to the writer, because it is the one case where going
     * back discards something. Otherwise whatever is outstanding is sent now,
     * as the pop starts rather than after its animation, and `"go"`.
     */
    const leave = useCallback((): "go" | "confirm" => {
        if (isClosedRef.current) return "go";
        if (unsendableRef.current) return "confirm";
        flushRef.current();
        return "go";
    }, []);

    /** What publish, archive and delete do with a failure. */
    const fail = useCallback((context: string, err: unknown) => {
        reportError(context, err);
        const message = getErrorMessage(err);
        setSaveError(isOurFailure(message) ? null : message);
        setSaveState("error");
    }, []);

    const removeExistingCover = useCallback(() => {
        setCoverRemoved(true);
        setExistingCoverUrl(null);
    }, []);

    /** Saves anything outstanding, then moves the article out of DRAFT. */
    const publish = useCallback(async (): Promise<Article | null> => {
        setIsBusy(true);
        try {
            // A save that failed leaves the server holding older text, and
            // going ahead would publish that instead of what is on screen —
            // so a failed save stops here, and its error is already showing.
            const saved = await saveChain();
            if (!saved) return null;

            const article = await articleApi.publishArticle(saved.id);
            setStatus(article.status);
            setSlug(article.slug);
            bumpRevision(article.id);
            return article;
        } catch (err) {
            fail("article.publish", err);
            return null;
        } finally {
            setIsBusy(false);
        }
    }, [saveChain, bumpRevision, fail]);

    const archive = useCallback(async (): Promise<boolean> => {
        const id = articleIdRef.current;
        if (!id) return false;
        setIsBusy(true);
        try {
            const article = await articleApi.archiveArticle(id);
            setStatus(article.status);
            bumpRevision(article.id);
            return true;
        } catch (err) {
            fail("article.archive", err);
            return false;
        } finally {
            setIsBusy(false);
        }
    }, [bumpRevision, fail]);

    const remove = useCallback(async (): Promise<boolean> => {
        const id = articleIdRef.current;
        if (!id) {
            isClosedRef.current = true;
            return true;
        }
        setIsBusy(true);
        try {
            await articleApi.deleteArticle(id);
            isClosedRef.current = true;
            return true;
        } catch (err) {
            fail("article.delete", err);
            return false;
        } finally {
            setIsBusy(false);
        }
    }, [fail]);

    return {
        draft,
        update,
        articleId,
        slug,
        status,
        existingCoverUrl,
        coverAsset,
        setCoverAsset,
        removeExistingCover,
        canSave,
        problem,
        isDirty,
        isBusy,
        saveState,
        saveError,
        save: saveChain,
        leave,
        publish,
        archive,
        remove,
    };
}

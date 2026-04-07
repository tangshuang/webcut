import { onMounted, ref } from 'vue';
import { useWebCutContext, useWebCutPlayer } from './index';
import { HistoryMachine } from '../libs/history-machine';
import {
    WebCutProjectHistoryData,
    WebCutProjectHistoryPushPayload,
    WebCutProjectHistoryState,
    WebCutSegment,
    WebCutSource,
    WebCutSourceData,
} from '../types';
import { clone, isEqual } from 'ts-fns';
import { applyHistoryPatch, createHistoryPatches } from '../libs/history-patch';
import { useT } from '../i18n/hooks';

const historyMachines = new Map<string, HistoryMachine>();

type WebCutHistoryPushOptions = {
    title?: string;
    before?: WebCutProjectHistoryState | null;
    after?: WebCutProjectHistoryState;
};

export function useWebCutHistory() {
    const {
        id: projectId,
        rails,
        sources,
        clips,
        sprites,
        canUndo,
        canRedo,
        canRecover,
        canvas,
        selected,
        current,
        updateByAspectRatio,
        loading,
        memory,
        disableRecoverHistory,
    } = useWebCutContext();
    const { push: pushToPlayer } = useWebCutPlayer();
    const t = useT();

    // 创建历史记录管理器实例
    let historyMachine = historyMachines.get(projectId.value)!;
    if (!historyMachine) {
        historyMachine = new HistoryMachine(projectId.value);
        historyMachines.set(projectId.value, historyMachine);
    }

    // 是否有项目状态可以恢复
    const dataToRecover = ref<Awaited<ReturnType<HistoryMachine['init']>> | null>(null);
    const historyList = ref<WebCutProjectHistoryData[]>([]);

    // 初始化历史记录
    onMounted(async () => {
        // 只允许执行一次
        if (memory.value[`isHistoryInited(${projectId.value})`]) {
            return;
        }
        memory.value[`isHistoryInited(${projectId.value})`] = true;

        const savedData = await historyMachine.init();
        await historyMachine.ready();
        historyList.value = await historyMachine.getHistoryList();
        if (savedData?.state) {
            // 禁止在刷新页面时，恢复历史记录中时间最近的一条记录, 则不执行恢复操作
            if (disableRecoverHistory.value) {
                canRecover.value = false;
                dataToRecover.value = null;
                return;
            }
            dataToRecover.value = savedData;
            canRecover.value = true;
            // 恢复一些视频基础配置
            const { aspectRatio } = savedData;
            if (aspectRatio) {
                updateByAspectRatio(aspectRatio);
            }
            // 页面刷新后自动恢复到最近一次历史镜像
            await recover();
        }
    });

    // 将source转换为source meta便于存储
    function convertSource(source: WebCutSource): WebCutSourceData {
        return {
            ...source,
            meta: clone(source.meta),
            clip: {
                meta: { ...source.clip.meta },
            },
            sprite: {
                time: { ...source.sprite.time },
                rect: {
                    x: source.sprite.rect.x,
                    y: source.sprite.rect.y,
                    w: source.sprite.rect.w,
                    h: source.sprite.rect.h,
                    angle: source.sprite.rect.angle,
                },
                zIndex: source.sprite.zIndex,
                opacity: source.sprite.opacity,
                flip: source.sprite.flip,
                visible: source.sprite.visible,
                interactable: source.sprite.interactable,
            },
        };
    }

    async function refreshHistoryList() {
        historyList.value = await historyMachine.getHistoryList();
    }

    function snapshot(): WebCutProjectHistoryState {
        const railsData = clone(rails.value);
        const sourcesData: Record<string, WebCutSourceData> = {};
        for (const [key, source] of sources.value.entries()) {
            sourcesData[key] = convertSource(source);
        }
        return {
            rails: railsData,
            sources: sourcesData,
        };
    }

    async function createEntry(options: WebCutHistoryPushOptions = {}): Promise<WebCutProjectHistoryPushPayload> {
        await historyMachine.ready();

        const afterState = options.after || snapshot();
        const fallbackBefore = await historyMachine.getCurrentState();
        const beforeState = options.before !== undefined ? options.before : fallbackBefore;
        const { patch, undoPatch } = createHistoryPatches(beforeState, afterState);

        return {
            title: options.title || '编辑变更',
            patch,
            undoPatch,
            snapshot: afterState,
            state: afterState,
        };
    }

    async function recoverSegment(source: WebCutSourceData, segment: WebCutSegment, railId: string) {
        const { sourceKey } = segment;
        const { type, fileId, url, text, sprite, meta } = source;
        const src = fileId ? `file:${fileId}` : url || text || '';
        const metaRect = clone(meta.rect);
        const hasRect = !!metaRect && Object.keys(metaRect).length > 0;
        await pushToPlayer(type as any, src, {
            id: sourceKey,
            // 仅在有明确 rect 时传入，避免空对象覆盖 autoFitSize 分支
            rect: hasRect ? metaRect : undefined,
            time: {
                start: sprite.time.offset,
                duration: sprite.time.duration,
                playbackRate: sprite.time.playbackRate,
            },
            zIndex: sprite.zIndex,
            opacity: sprite.opacity,
            flip: sprite.flip,
            visible: sprite.visible,
            interactable: sprite.interactable,
            audio: clone(meta.audio),
            video: clone(meta.video),
            // TODO text的处理比较复杂，需进一步研究，可能需要从seg上获取
            text: clone(meta.text),
            animation: clone(meta.animation),
            autoFitSize: meta.autoFitSize || (meta as any).autoFitRect,
            withRailId: railId,
            withSegmentId: segment.id,
        });
    }

    // 比较两个 source 的属性是否相同（排除 clip 和 sprite 对象本身）
    function isSameSourceData(current: WebCutSource, target: WebCutSourceData): boolean {
        // 比较 sprite 属性
        const currentSprite = current.sprite;
        const targetSprite = target.sprite;

        if (currentSprite.time.offset !== targetSprite.time.offset ||
            currentSprite.time.duration !== targetSprite.time.duration ||
            currentSprite.time.playbackRate !== targetSprite.time.playbackRate) {
            return false;
        }

        if (currentSprite.rect.x !== targetSprite.rect.x ||
            currentSprite.rect.y !== targetSprite.rect.y ||
            currentSprite.rect.w !== targetSprite.rect.w ||
            currentSprite.rect.h !== targetSprite.rect.h ||
            currentSprite.rect.angle !== targetSprite.rect.angle) {
            return false;
        }

        if (currentSprite.zIndex !== targetSprite.zIndex ||
            currentSprite.opacity !== targetSprite.opacity ||
            currentSprite.flip !== targetSprite.flip ||
            currentSprite.visible !== targetSprite.visible ||
            currentSprite.interactable !== targetSprite.interactable) {
            return false;
        }

        // 比较 meta 属性
        if (!isEqual(current.meta, target.meta)) {
            return false;
        }

        // 比较文本内容
        if (current.text !== target.text) {
            return false;
        }

        return true;
    }

    // 更新现有 source 的属性（避免重建）
    function updateSourceProperties(current: WebCutSource, target: WebCutSourceData) {
        const { sprite } = current;
        const targetSprite = target.sprite;

        // 更新 sprite 的 time 属性
        sprite.time.offset = targetSprite.time.offset;
        sprite.time.duration = targetSprite.time.duration;
        sprite.time.playbackRate = targetSprite.time.playbackRate;

        // 更新 sprite 的 rect 属性
        sprite.rect.x = targetSprite.rect.x;
        sprite.rect.y = targetSprite.rect.y;
        sprite.rect.w = targetSprite.rect.w;
        sprite.rect.h = targetSprite.rect.h;
        sprite.rect.angle = targetSprite.rect.angle;

        // 更新 sprite 的其他属性
        sprite.zIndex = targetSprite.zIndex;
        sprite.opacity = targetSprite.opacity;
        sprite.flip = targetSprite.flip;
        sprite.visible = targetSprite.visible;
        sprite.interactable = targetSprite.interactable;

        // 更新 meta 属性
        current.meta = clone(target.meta);
    }

    /**
     * 使用完整的历史记录状态恢复项目状态。
     * 本质上，它是直接覆盖当前的历史记录，而不是追加。
     * @param historyState
     */
    async function recoverHistory(historyState: WebCutProjectHistoryState) {
        const targetSourcesMap = historyState.sources;
        const currentSourceKeys = new Set(sources.value.keys());
        const targetSourceKeys = new Set(Object.keys(targetSourcesMap));

        // 1. 找出需要删除的 sources（在当前但不在目标中）
        const toDelete = new Set<string>();
        for (const key of currentSourceKeys) {
            if (!targetSourceKeys.has(key)) {
                toDelete.add(key);
            }
        }

        // 2. 找出需要添加的 sources（在目标但不在当前中）
        const toAdd = new Set<string>();
        for (const key of targetSourceKeys) {
            if (!currentSourceKeys.has(key)) {
                toAdd.add(key);
            }
        }

        // 3. 找出可能需要更新的 sources（在两者都存在）
        const toUpdate = new Set<string>();
        for (const key of currentSourceKeys) {
            if (targetSourceKeys.has(key)) {
                toUpdate.add(key);
            }
        }

        // 4. 删除不需要的 sources
        for (const key of toDelete) {
            const source = sources.value.get(key);
            if (source) {
                const { clip, sprite } = source;
                canvas.value?.removeSprite(sprite);
                sprite.destroy();
                clip.destroy();

                const sprIdx = sprites.value.indexOf(sprite);
                if (sprIdx !== -1) {
                    sprites.value.splice(sprIdx, 1);
                }

                const clipIdx = clips.value.indexOf(clip);
                if (clipIdx !== -1) {
                    clips.value.splice(clipIdx, 1);
                }

                sources.value.delete(key);
            }
        }

        // 5. 更新现有的 sources
        for (const key of toUpdate) {
            const current = sources.value.get(key)!;
            const target = targetSourcesMap[key];

            // 如果属性相同，跳过更新
            if (isSameSourceData(current, target)) {
                continue;
            }

            // 对于文本类型，如果文本内容或样式变化，需要重新生成
            if (current.type === 'text' &&
                (current.text !== target.text || !isEqual(current.meta.text, target.meta.text))) {
                // 文本内容变化，需要重建
                toDelete.add(key);
                toAdd.add(key);

                // 先删除旧的
                const { clip, sprite } = current;
                canvas.value?.removeSprite(sprite);
                sprite.destroy();
                clip.destroy();

                const sprIdx = sprites.value.indexOf(sprite);
                if (sprIdx !== -1) {
                    sprites.value.splice(sprIdx, 1);
                }

                const clipIdx = clips.value.indexOf(clip);
                if (clipIdx !== -1) {
                    clips.value.splice(clipIdx, 1);
                }

                sources.value.delete(key);
            } else {
                // 非文本或文本内容未变化，只更新属性
                updateSourceProperties(current, target);
            }
        }

        // 6. 添加新的 sources
        for (const rail of historyState.rails) {
            const { segments } = rail;
            for (const seg of segments) {
                const { sourceKey } = seg;
                if (toAdd.has(sourceKey)) {
                    const source = targetSourcesMap[sourceKey];
                    if (source) {
                        await recoverSegment(source, seg, rail.id);
                    }
                }
            }
        }

        // 7. 更新 rails（rails 是轻量级数据，直接替换）
        rails.value = clone(historyState.rails);

        // 8. 清除选中状态
        selected.value = [];
        current.value = null;

        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    }

    // 整个组件只能执行一次，避免重复执行
    let isRecovered = false;
    async function recover() {
        loading.value = true;
        try {
            if (isRecovered) {
                return;
            }
            isRecovered = true;

            const projectState = dataToRecover.value;
            if (!projectState) {
                return;
            }

            const { aspectRatio, state } = projectState;
            if (aspectRatio) {
                updateByAspectRatio(aspectRatio);
            }
            await recoverHistory(state);

            dataToRecover.value = null;
            canRecover.value = false;
            canUndo.value = historyMachine.canUndo();
            canRedo.value = historyMachine.canRedo();
            await refreshHistoryList();
        } finally {
            loading.value = false;
        }
    }

    async function recoverToHistory(historyId: string) {
        if (!historyId) {
            return;
        }

        loading.value = true;
        try {
            const target = await historyMachine.moveTo(historyId);
            if (!target) {
                return;
            }
            const targetState = target.snapshot || target.state;
            await recoverHistory(targetState);
            canRecover.value = false;
            dataToRecover.value = null;
            await refreshHistoryList();
        } finally {
            loading.value = false;
        }
    }

    // 撤销操作
    async function undo() {
        loading.value = true;
        try {
            const beforeState = snapshot();
            const currentHistory = await historyMachine.getCurrentHistory();
            const history = await historyMachine.undo();
            if (!history) {
                return;
            }
            if (currentHistory?.undoPatch?.operations?.length) {
                const nextState = applyHistoryPatch(beforeState, currentHistory.undoPatch);
                await recoverHistory(nextState);
            }
            else {
                const state = history.snapshot || history.state;
                await recoverHistory(state);
            }
            await refreshHistoryList();
        } finally {
            loading.value = false;
        }
    }

    // 重做操作
    async function redo() {
        loading.value = true;
        try {
            const beforeState = snapshot();
            const history = await historyMachine.redo();
            if (!history) {
                return;
            }
            if (history.patch?.operations?.length) {
                const nextState = applyHistoryPatch(beforeState, history.patch);
                await recoverHistory(nextState);
            }
            else {
                const state = history.snapshot || history.state;
                await recoverHistory(state);
            }
            await refreshHistoryList();
        } finally {
            loading.value = false;
        }
    }

    // 清除历史记录
    async function clear() {
        await historyMachine.clear();
        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
        canRecover.value = false;
        dataToRecover.value = null;
        historyList.value = [];
    }

    async function push(options: WebCutHistoryPushOptions = {}) {
        await historyMachine.ready();

        // 如果有项目状态可以恢复，先清除历史记录
        if (canRecover.value) {
            await historyMachine.clear();
        }

        const entry = await createEntry(options);
        if (!entry.patch?.operations.length && !entry.undoPatch?.operations.length) {
            canUndo.value = historyMachine.canUndo();
            canRedo.value = historyMachine.canRedo();
            return null;
        }

        const historyId = await historyMachine.push(entry);
        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
        canRecover.value = false;
        dataToRecover.value = null;
        await refreshHistoryList();
        return historyId;
    }

    /**
     * 替换当前项目状态为指定状态。注意，该操作可以清空所有历史记录。
     * @param state 新状态
     * @param title 操作标题
     * @returns
     */
    async function replaceWithState(state: WebCutProjectHistoryState, title?: string) {
        loading.value = true;
        try {
            // 清空所有历史记录
            await clear();

            // 以当前运行态重新快照，避免外部构建 state 与运行时属性（如 rect）不一致
            await recoverHistory(state);
            canRecover.value = false;
            dataToRecover.value = null;
            const nextState = snapshot();

            // 推送新的历史记录
            const historyId = await push({
                title: title || t('Replace history'),
                before: null,
                after: nextState,
            });

            return historyId;
        } finally {
            loading.value = false;
        }
    }

    return {
        push,
        snapshot,
        createEntry,
        replaceWithState,
        historyList,
        refreshHistoryList,
        recoverToHistory,
        undo,
        redo,
        clear,
        canUndo,
        canRedo,
        canRecover,
        recover,
    };
}

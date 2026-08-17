import { onMounted, ref } from 'vue';
import { useWebCutContext, useWebCutPlayer } from './index';
import { HistoryMachine } from '../libs/history-machine';
import {
    WebCutProjectHistoryData,
    WebCutProjectHistoryState,
    WebCutSegment,
    WebCutSource,
    WebCutSourceData,
} from '../types';
import { clone, isEqual } from 'ts-fns';
import { createHistoryPatches } from '../libs/history-patch';
import { AsyncQueue } from '../libs/async-queue';
import { detachSourceToPark, disposeSourcePark, salvageSourceFromPark } from './source-park';
import { useT } from '../i18n/hooks';

const historyMachines = new Map<string, HistoryMachine>();
// 每个 project 一个串行队列：push/undo/redo/恢复 全部排队执行，彻底消除并发交错
const historyQueues = new Map<string, AsyncQueue>();

// —— 手势事务：一次连续调整（拖拽/滑杆/输入）只产生一条历史 ——
type WebCutHistoryTransaction = {
    title: string;
    mergeKey?: string;
    /** 手势开始时的项目状态（作为该条历史的 before） */
    before: WebCutProjectHistoryState | null;
    timer?: ReturnType<typeof setTimeout>;
};
const transactions = new Map<string, WebCutHistoryTransaction | null>();

// 手势合并窗口：同 mergeKey 在窗口内的后续提交会合并进最后一条历史
const MERGE_WINDOW = 5000;
// touch 默认静默期：停止调整多久后落一条历史
const TOUCH_DELAY = 800;

// —— 驻留池：见 ./source-park（history 与素材删除等路径共享） ——

// 外部模块（如画布交互）触发历史打点的注册表，避免循环依赖
const touchHandlers = new Map<string, (options: { title?: string; mergeKey?: string; delay?: number }) => void>();
export function requestHistoryTouch(projectId: string, options: { title?: string; mergeKey?: string; delay?: number }) {
    const handler = touchHandlers.get(projectId);
    if (handler) {
        handler(options);
    }
}

type WebCutHistoryPushOptions = {
    title?: string;
    before?: WebCutProjectHistoryState | null;
    after?: WebCutProjectHistoryState;
    mergeKey?: string;
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
        updateDuration,
        cursorTime,
    } = useWebCutContext();
    const { push: pushToPlayer, clear: clearPlayer, syncSourceTickInterceptor, applyAnimation, resort } = useWebCutPlayer();
    const t = useT();

    // 创建历史记录管理器实例
    let historyMachine = historyMachines.get(projectId.value)!;
    if (!historyMachine) {
        historyMachine = new HistoryMachine(projectId.value);
        historyMachines.set(projectId.value, historyMachine);
    }

    // 串行队列
    let historyQueue = historyQueues.get(projectId.value)!;
    if (!historyQueue) {
        historyQueue = new AsyncQueue();
        historyQueues.set(projectId.value, historyQueue);
    }

    function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        return historyQueue.push(async () => {
            try {
                return await fn();
            }
            catch (err) {
                // 队列任务失败不阻断后续任务，但保留可追溯的错误信息
                console.error('[webcut history] task error:', err);
                return null as unknown as T;
            }
        }) as unknown as Promise<T>;
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

    // ==================== 事务（手势级历史记账） ====================

    function getActiveTransaction() {
        return transactions.get(projectId.value) || null;
    }

    function takeTransaction(): WebCutHistoryTransaction | null {
        const tx = transactions.get(projectId.value) || null;
        if (tx?.timer) {
            clearTimeout(tx.timer);
        }
        transactions.set(projectId.value, null);
        return tx;
    }

    /**
     * 开启一个手势事务。事务期间的调整不会立即产生历史，
     * 结束（commit/touch 静默）后以事务开始前的状态为 before 记一条历史。
     * 已有活动事务时直接复用（同一手势的延续）。
     */
    function beginTransaction(options: { title?: string; mergeKey?: string } = {}) {
        const existing = getActiveTransaction();
        if (existing) {
            if (options.title) {
                existing.title = options.title;
            }
            if (options.mergeKey) {
                existing.mergeKey = options.mergeKey;
            }
            return existing;
        }
        const tx: WebCutHistoryTransaction = {
            title: options.title || '编辑变更',
            mergeKey: options.mergeKey,
            // 以当前指针位置的快照为 before（内存缓存，同步可得）
            before: historyMachine.getCurrentStateSync(),
        };
        transactions.set(projectId.value, tx);
        return tx;
    }

    /** 显式提交当前事务（进入串行队列落历史） */
    function commitTransaction() {
        const tx = takeTransaction();
        if (!tx) {
            return Promise.resolve(null);
        }
        return runExclusive(() => doPushEntry({ title: tx.title, before: tx.before, mergeKey: tx.mergeKey }));
    }

    /** 放弃当前事务（不产生历史） */
    function cancelTransaction() {
        takeTransaction();
    }

    /**
     * 触碰式记账：连续调整（拖拽/滑杆/输入）期间反复调用，
     * 静默 delay 毫秒后自动提交一条历史；同 mergeKey 的提交会合并进最后一条。
     */
    function touch(options: { title?: string; mergeKey?: string; delay?: number } = {}) {
        const active = getActiveTransaction();
        // 活动事务是别的手势（mergeKey 不同）→ 先让旧事务尽快落账，再开新事务
        if (active && options.mergeKey && active.mergeKey && active.mergeKey !== options.mergeKey) {
            const old = takeTransaction();
            if (old) {
                if (old.timer) {
                    clearTimeout(old.timer);
                }
                setTimeout(() => {
                    void runExclusive(() => doPushEntry({ title: old.title, before: old.before, mergeKey: old.mergeKey }));
                }, 0);
            }
        }
        const tx = beginTransaction(options);
        if (tx.timer) {
            clearTimeout(tx.timer);
        }
        tx.timer = setTimeout(() => {
            void commitTransaction();
        }, options.delay ?? TOUCH_DELAY);
    }

    // 注册给画布交互等外部模块使用
    if (!touchHandlers.has(projectId.value)) {
        touchHandlers.set(projectId.value, touch);
    }

    // ==================== 历史落账 ====================

    async function doPushEntry(options: WebCutHistoryPushOptions = {}): Promise<string | null> {
        await historyMachine.ready();

        // 如果有项目状态可以恢复，先清除历史记录
        if (canRecover.value) {
            await historyMachine.clear();
        }

        const afterState = options.after || snapshot();
        const beforeState = options.before !== undefined ? options.before : await historyMachine.getCurrentState();

        // 手势合并：指针在栈顶 + 同 mergeKey + 时间窗口内 → 原地更新最后一条
        if (options.mergeKey && options.before !== undefined) {
            const last = await historyMachine.getCurrentHistory();
            if (last?.mergeKey === options.mergeKey
                && historyMachine.isAtLast()
                && Date.now() - last.timestamp < MERGE_WINDOW) {
                const { patch, undoPatch } = createHistoryPatches(beforeState, afterState);
                if (!patch.operations.length && !undoPatch.operations.length) {
                    canUndo.value = historyMachine.canUndo();
                    canRedo.value = historyMachine.canRedo();
                    return last.id;
                }
                const ok = await historyMachine.updateEntry(last.id, {
                    title: options.title || last.title,
                    timestamp: Date.now(),
                    patch,
                    undoPatch,
                    snapshot: afterState,
                    mergeKey: options.mergeKey,
                });
                if (ok) {
                    canUndo.value = historyMachine.canUndo();
                    canRedo.value = historyMachine.canRedo();
                    canRecover.value = false;
                    dataToRecover.value = null;
                    await refreshHistoryList();
                    return last.id;
                }
            }
        }

        const { patch, undoPatch } = createHistoryPatches(beforeState, afterState);
        if (!patch?.operations.length && !undoPatch?.operations.length) {
            canUndo.value = historyMachine.canUndo();
            canRedo.value = historyMachine.canRedo();
            return null;
        }

        const historyId = await historyMachine.push({
            title: options.title,
            patch,
            undoPatch,
            snapshot: afterState,
            mergeKey: options.mergeKey,
        });
        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
        canRecover.value = false;
        dataToRecover.value = null;
        await refreshHistoryList();
        return historyId;
    }

    async function push(options: WebCutHistoryPushOptions = {}) {
        return await runExclusive(async () => {
            // 有未提交的手势事务时先落账，避免状态错序
            if (!options.mergeKey) {
                const tx = takeTransaction();
                if (tx) {
                    await doPushEntry({ title: tx.title, before: tx.before, mergeKey: tx.mergeKey });
                }
            }
            return await doPushEntry(options);
        });
    }

    // ==================== 驻留池（undo/redo 复用 source） ====================

    /**
     * 将 source 从运行时摘除但不销毁，进入驻留池等待复活。
     * undo/redo 往返时可直接复活，避免反复创建/销毁解码器导致的内存与恢复失败问题。
     */
    function detachSource(key: string) {
        const source = sources.value.get(key);
        if (!source) {
            return;
        }
        detachSourceToPark(projectId.value, source, {
            canvas: canvas.value,
            sprites: sprites.value,
            clips: clips.value,
            sourcesMap: sources.value,
        });
    }

    /** 尝试从驻留池复活与目标身份一致的 source，身份不符则销毁并返回 null */
    function salvageParkedSource(key: string, target: WebCutSourceData): WebCutSource | null {
        return salvageSourceFromPark(projectId.value, key, (parked) => !shouldRebuildRuntime(parked, target));
    }

    /** 重新挂载一个驻留的 source */
    async function attachSource(source: WebCutSource, segmentId: string, railId: string) {
        source.segmentId = segmentId;
        source.railId = railId;
        sources.value.set(source.key, source);
        if (!sprites.value.includes(source.sprite)) {
            sprites.value.push(source.sprite);
        }
        if (!clips.value.includes(source.clip)) {
            clips.value.push(source.clip);
        }
        await canvas.value?.addSprite(source.sprite);
    }

    function disposeParkedSources() {
        disposeSourcePark(projectId.value);
    }

    // ==================== 恢复引擎（doc → runtime 最小应用） ====================

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

    /** 素材文件内的入点（曾被 split 过则非 0） */
    function getSourceInPoint(source: WebCutSource | WebCutSourceData): number {
        const meta: any = source.meta;
        return meta?.[source.type]?.offset || 0;
    }

    /**
     * 必须重建 runtime（clip/sprite）的条件，收敛为「素材身份」变化：
     * 类型、文件来源（fileId/url）、文件入点、文本内容/样式。
     * 其余一切（位置/时长/变速/滤镜/动画/音量等）均可原地更新。
     */
    function shouldRebuildRuntime(current: WebCutSource | WebCutSourceData, target: WebCutSourceData): boolean {
        if (current.type !== target.type) {
            return true;
        }
        if (current.fileId !== target.fileId || current.url !== target.url) {
            return true;
        }
        if (getSourceInPoint(current) !== getSourceInPoint(target)) {
            return true;
        }
        if (current.type === 'text' &&
            (current.text !== target.text || !isEqual((current.meta as any).text, target.meta?.text))) {
            return true;
        }
        return false;
    }

    /** L1 原地更新：仅改写 sprite 属性与 meta，不重建 clip/sprite。返回动画配置是否发生变化 */
    function updateSourceProperties(current: WebCutSource, target: WebCutSourceData) {
        const { sprite } = current;
        const targetSprite = target.sprite;

        sprite.time.offset = targetSprite.time.offset;
        sprite.time.duration = targetSprite.time.duration;
        sprite.time.playbackRate = targetSprite.time.playbackRate;

        sprite.rect.x = targetSprite.rect.x;
        sprite.rect.y = targetSprite.rect.y;
        sprite.rect.w = targetSprite.rect.w;
        sprite.rect.h = targetSprite.rect.h;
        sprite.rect.angle = targetSprite.rect.angle;

        sprite.zIndex = targetSprite.zIndex;
        sprite.opacity = targetSprite.opacity;
        sprite.flip = targetSprite.flip;
        sprite.visible = targetSprite.visible;
        sprite.interactable = targetSprite.interactable;

        const animationChanged = !isEqual((current.meta as any).animation ?? null, (target.meta as any).animation ?? null);
        current.meta = clone(target.meta);
        return animationChanged;
    }

    async function recoverSegment(source: WebCutSourceData, segment: WebCutSegment, railId: string) {
        const { sourceKey } = segment;
        const { type, fileId, url, text, sprite, meta } = source;
        const src = fileId ? `file:${fileId}` : url || text || '';
        const metaAny = clone(meta) as any;
        // 恢复场景 rect 已知，禁止 autoFit 重算覆盖快照中的精确位置
        delete metaAny.autoFitSize;
        delete metaAny.autoFitRect;
        const metaRect = metaAny.rect;
        const hasRect = !!metaRect && Object.keys(metaRect).length > 0;
        // push 内部在 playbackRate !== 1 时会按「文件时长 / rate」换算显示时长，
        // 因此这里必须传文件时长（originalDuration），否则变速素材会被二次换算
        const rate = sprite.time.playbackRate || 1;
        const fileDuration = (meta as any).time?.originalDuration ?? sprite.time.duration * rate;
        await pushToPlayer(type as any, src, {
            id: sourceKey,
            // 仅在有明确 rect 时传入，避免空对象覆盖 autoFitSize 分支
            rect: hasRect ? metaRect : undefined,
            time: {
                start: sprite.time.offset,
                duration: fileDuration,
                playbackRate: sprite.time.playbackRate,
                // 恢复文件原始时长，供后续变速换算使用
                originalDuration: (meta as any).time?.originalDuration,
            },
            zIndex: sprite.zIndex,
            opacity: sprite.opacity,
            flip: sprite.flip,
            visible: sprite.visible,
            interactable: sprite.interactable,
            audio: clone((meta as any).audio),
            video: clone((meta as any).video),
            text: clone((meta as any).text),
            animation: clone((meta as any).animation),
            withRailId: railId,
            withSegmentId: segment.id,
        });
    }

    /**
     * 使用完整的历史记录状态恢复项目状态（doc → runtime 的同步器）。
     * 分级应用：L1 原地更新属性 / L2+L3 身份变化或增删时重建（优先从驻留池复活）。
     */
    async function recoverHistory(historyState: WebCutProjectHistoryState) {
        const targetSourcesMap = historyState.sources;
        const currentSourceKeys = new Set(sources.value.keys());
        const targetSourceKeys = new Set(Object.keys(targetSourcesMap));

        // 1. 找出需要删除的 sources（在当前但不在目标中）→ 驻留而非销毁
        for (const key of currentSourceKeys) {
            if (!targetSourceKeys.has(key)) {
                detachSource(key);
            }
        }

        // 2. 逐个处理两边都存在的 sources：属性一致跳过；身份变化 → 驻留旧的并标记重建；否则 L1 原地更新
        const updatedKeys = new Set<string>();
        const animationChangedKeys = new Set<string>();
        const toAdd = new Set<string>();
        for (const key of currentSourceKeys) {
            if (!targetSourceKeys.has(key)) {
                continue;
            }
            const current = sources.value.get(key)!;
            const target = targetSourcesMap[key];

            if (isSameSourceData(current, target)) {
                continue;
            }

            if (shouldRebuildRuntime(current, target)) {
                detachSource(key);
                toAdd.add(key);
            }
            else {
                const animationChanged = updateSourceProperties(current, target);
                updatedKeys.add(key);
                if (animationChanged) {
                    animationChangedKeys.add(key);
                }
            }
        }

        // 3. 补充目标中新增的 sources
        for (const key of targetSourceKeys) {
            if (!currentSourceKeys.has(key)) {
                toAdd.add(key);
            }
        }

        // 4. 重建/复活：按目标 rails 的顺序逐个（串行，避免解码并发争用）
        for (const rail of historyState.rails) {
            const { segments } = rail;
            for (const seg of segments) {
                const { sourceKey } = seg;
                if (!toAdd.has(sourceKey)) {
                    continue;
                }
                const source = targetSourcesMap[sourceKey];
                if (!source) {
                    continue;
                }
                const parked = salvageParkedSource(sourceKey, source);
                if (parked) {
                    await attachSource(parked, seg.id, rail.id);
                    const animationChanged = updateSourceProperties(parked, source);
                    updatedKeys.add(sourceKey);
                    if (animationChanged) {
                        animationChangedKeys.add(sourceKey);
                    }
                }
                else {
                    await recoverSegment(source, seg, rail.id);
                }
            }
        }

        // 5. 更新 rails（rails 是轻量级数据，直接替换）
        rails.value = clone(historyState.rails);

        // 5.1 同步 source 与新 rails 的关联（跨轨道移动等场景 railId/segmentId 可能变化）
        for (const rail of rails.value) {
            for (const seg of rail.segments) {
                const related = sources.value.get(seg.sourceKey);
                if (related && (related.railId !== rail.id || related.segmentId !== seg.id)) {
                    related.railId = rail.id;
                    related.segmentId = seg.id;
                }
            }
        }

        // 6. 选中状态按新 rails 过滤（保留仍存在的选中，而非全清）
        selected.value = selected.value.filter(({ segmentId, railId }) =>
            rails.value.some(rail => rail.id === railId && rail.segments.some(seg => seg.id === segmentId)));
        if (current.value && !selected.value.some(item => item.segmentId === current.value!.segmentId && item.railId === current.value!.railId)) {
            current.value = null;
        }

        // 7. 统一收尾：动画重算/清除、tickInterceptor 刷新、层级排序、总时长、画面重绘
        for (const key of animationChangedKeys) {
            const source = sources.value.get(key);
            if (!source) {
                continue;
            }
            try {
                // animation 为 null 时会清除现有动画
                await applyAnimation(key, source.meta.animation ?? null);
            } catch {}
        }
        for (const key of updatedKeys) {
            syncSourceTickInterceptor(key);
        }
        resort();
        updateDuration();
        canvas.value?.previewFrame(cursorTime.value);

        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    }

    // 整个组件只能执行一次，避免重复执行
    let isRecovered = false;
    async function recover() {
        await runExclusive(async () => {
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
        });
    }

    async function recoverToHistory(historyId: string) {
        if (!historyId) {
            return;
        }

        await runExclusive(async () => {
            loading.value = true;
            try {
                // 先落定未提交的手势事务
                const tx = takeTransaction();
                if (tx) {
                    await doPushEntry({ title: tx.title, before: tx.before, mergeKey: tx.mergeKey });
                }

                const target = await historyMachine.moveTo(historyId);
                if (!target) {
                    return;
                }
                const targetState = (target as any).snapshot || target.state || await historyMachine.getCurrentState();
                await recoverHistory(targetState);
                canRecover.value = false;
                dataToRecover.value = null;
                await refreshHistoryList();
            } finally {
                loading.value = false;
            }
        });
    }

    // 撤销操作：直接使用目标历史快照恢复，不再从运行态反推
    async function undo() {
        await runExclusive(async () => {
            loading.value = true;
            try {
                // 先落定未提交的手势事务，保证 undo 边界完整
                const tx = takeTransaction();
                if (tx) {
                    await doPushEntry({ title: tx.title, before: tx.before, mergeKey: tx.mergeKey });
                }

                const history = await historyMachine.undo();
                if (!history) {
                    return;
                }
                const state = (history as any).snapshot || history.state;
                if (state) {
                    await recoverHistory(state);
                }
                await refreshHistoryList();
            } finally {
                loading.value = false;
            }
        });
    }

    // 重做操作：直接使用目标历史快照恢复
    async function redo() {
        await runExclusive(async () => {
            loading.value = true;
            try {
                // 先落定未提交的手势事务，保证 redo 边界完整
                const tx = takeTransaction();
                if (tx) {
                    await doPushEntry({ title: tx.title, before: tx.before, mergeKey: tx.mergeKey });
                }

                const history = await historyMachine.redo();
                if (!history) {
                    return;
                }
                const state = (history as any).snapshot || history.state;
                if (state) {
                    await recoverHistory(state);
                }
                await refreshHistoryList();
            } finally {
                loading.value = false;
            }
        });
    }

    // 清除历史记录
    async function clear() {
        await runExclusive(async () => {
            cancelTransaction();
            await historyMachine.clear();
            disposeParkedSources();
            canUndo.value = historyMachine.canUndo();
            canRedo.value = historyMachine.canRedo();
            canRecover.value = false;
            dataToRecover.value = null;
            historyList.value = [];
        });
    }

    /**
     * 替换当前项目状态为指定状态。注意，该操作可以清空所有历史记录。
     * @param state 新状态
     * @param title 操作标题
     * @returns
     */
    async function replaceWithState(state: WebCutProjectHistoryState, title?: string) {
        await runExclusive(async () => {
            loading.value = true;
            try {
                cancelTransaction();

                // 清空所有历史记录
                await historyMachine.clear();
                disposeParkedSources();

                // 以当前运行态重新快照，避免外部构建 state 与运行时属性（如 rect）不一致
                await recoverHistory(state);
                canRecover.value = false;
                dataToRecover.value = null;
                const nextState = snapshot();

                // 推送新的历史记录
                await doPushEntry({
                    title: title || t('Replace history'),
                    before: null,
                    after: nextState,
                });
            } finally {
                loading.value = false;
            }
        });
    }

    /**
     * 基于当前状态进行一次全量重建渲染。
     * 不变更历史记录，仅用于修复视图渲染不一致问题。
     */
    async function refreshRender() {
        await runExclusive(async () => {
            loading.value = true;
            try {
                const state = snapshot();
                clearPlayer();
                await recoverHistory(state);
            } finally {
                loading.value = false;
            }
        });
    }

    return {
        push,
        snapshot,
        replaceWithState,
        refreshRender,
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
        loading,
        // 事务 API
        beginTransaction,
        commitTransaction,
        cancelTransaction,
        touch,
    };
}

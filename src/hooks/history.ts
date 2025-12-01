import { onMounted, watch, ref, computed } from 'vue';
import { useWebCutContext } from './index';
import { useWebCutPlayer } from './index';
import { HistoryMachine } from '../libs/history-machine';
import { WebCutSourceMeta, WebCutSource, WebCutSegment } from '../types';
import { clone, debounce } from 'ts-fns';
import { setProjectState } from '../db';
import { action } from 'fods';
import { useWebCutManager } from './manager';

const updateProjectState = action((projectId: string, state: any) => setProjectState(projectId, state));
const historyMachines = new Map<string, HistoryMachine>();

export function useWebCutHistory() {
    const { id: projectId, rails, sources, canUndo, canRedo } = useWebCutContext();
    const { push } = useWebCutPlayer();
    const { deleteSegment } = useWebCutManager();

    // 创建历史记录管理器实例
    let historyMachine = historyMachines.get(projectId.value)!;
    if (!historyMachine) {
        historyMachine = new HistoryMachine(projectId.value);
        historyMachines.set(projectId.value, historyMachine);
    }

    const savedProjectState = ref<any>();

    // 是否有项目状态可以恢复
    const canRecover = computed(() => {
        return !!savedProjectState.value;
    });

    // 初始化历史记录
    onMounted(async () => {
        if (!historyMachine.isInitialized) {
            await historyMachine.init();
        }
        savedProjectState.value = historyMachine.projectState;
        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    });

    watch([sources, rails], debounce(async ([newSources, newRails]) => {
        if (!historyMachine.isInitialized) {
            return;
        }
        try {
            const rails = clone(newRails);
            const sources: any = {};
            for (const [key, source] of newSources.entries()) {
                const meta = convertSource(source);
                sources[key] = meta;
            }
            await updateProjectState(projectId.value, { rails, sources });
        } catch (e) {
            console.error(e);
        }
    }, 500), { deep: true });

    // 将source转换为source meta便于存储
    function convertSource(source: WebCutSource): WebCutSourceMeta {
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

    async function recoverSegment(source: WebCutSourceMeta, segment: WebCutSegment, railId: string) {
        const { sourceKey } = segment;
        const { type, fileId, url, text, sprite, meta } = source;
        const src = fileId ? `file:${fileId}` : url || text || '';
        await push(type as any, src, {
            id: sourceKey,
            rect: sprite.rect,
            time: {
                start: sprite.time.offset,
                duration: sprite.time.duration,
                playbackRate: sprite.time.playbackRate,
            },
            zIndex: sprite.zIndex,
            audio: meta.audio,
            video: meta.video,
            // TODO text的处理比较复杂，需进一步研究，可能需要从seg上获取
            // text: meta.text,
            autoFitRect: meta.autoFitRect,
            withRailId: railId,
            withSegmentId: segment.id,
        });
    }

    // 整个组件只能执行一次，避免重复执行
    let isRecovered = false;
    async function recoverProjectState() {
        if (isRecovered) {
            return;
        }
        isRecovered = true;

        await historyMachine.init();

        const projectState = savedProjectState.value;
        if (!projectState) {
            return;
        }

        const sourcesMap = projectState.sources;

        for (const rail of projectState.rails) {
            const { segments } = rail;
            for (const seg of segments) {
                const { sourceKey } = seg;
                const source = sourcesMap[sourceKey];
                if (!source) {
                    continue;
                }
                await recoverSegment(source, seg, rail.id);
            }
        }
    }

    // 保存当前状态到历史记录
    const pushHistory = async (state: any) => {
        const { action } = state;

        if (action === 'materialDeleted') {
            const { deletedFromRailId, deletedSegmentId, sourceKey } = state;
            const rail = rails.value.find((item) => item.id === deletedFromRailId)!;
            const seg = rail.segments.find((item) => item.id === deletedSegmentId)!;
            const source = sources.value.get(sourceKey)!;
            const deletedSegmentData = clone(seg);
            const sourceMeta = convertSource(source);
            const data = {
                ...state,
                deletedSegmentData,
                sourceMeta,
            };
            await historyMachine.push(data);
        }

        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    };

    // 撤销操作
    const undo = async () => {
        const state = await historyMachine.undo();
        if (!state) {
            return;
        }

        // TODO 根据不同type来决定如何处理
        if (state.action === 'materialDeleted') {
            const { sourceMeta, deletedSegmentData, deletedFromRailId } = state;
            await recoverSegment(sourceMeta, deletedSegmentData, deletedFromRailId);
        }

        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    };

    // 重做操作
    const redo = async () => {
        const state = await historyMachine.redo();
        if (!state) {
            return;
        }

        // TODO 根据不同type来决定如何处理
        if (state.action === 'materialDeleted') {
            const { deletedFromRailId, deletedSegmentId } = state;
            const rail = rails.value.find((item) => item.id === deletedFromRailId)!;
            if (!rail) {
                return;
            }
            const segment = rail.segments.find((item) => item.id === deletedSegmentId)!;
            if (!segment) {
                return;
            }
            deleteSegment({ segment, rail });
        }

        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    };

    // 清除历史记录
    const clearHistory = async () => {
        await historyMachine.clear();
        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    };

    return {
        pushHistory,
        undo,
        redo,
        clearHistory,
        canUndo,
        canRedo,
        canRecover,
        recoverProjectState,
    };
}
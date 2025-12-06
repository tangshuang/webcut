import { onMounted, ref, markRaw } from 'vue';
import { useWebCutContext } from './index';
import { useWebCutPlayer } from './index';
import { HistoryMachine } from '../libs/history-machine';
import { WebCutSourceData, WebCutSource, WebCutSegment, WebCutProjectHistoryState } from '../types';
import { clone } from 'ts-fns';

const historyMachines = new Map<string, HistoryMachine>();

export function useWebCutHistory() {
    const { id: projectId, rails, sources, canUndo, canRedo, canvas, selected, current, clips, sprites, cursorTime, updateByAspectRatio } = useWebCutContext();
    const { push: pushToPlayer } = useWebCutPlayer();

    // 创建历史记录管理器实例
    let historyMachine = historyMachines.get(projectId.value)!;
    if (!historyMachine) {
        historyMachine = new HistoryMachine(projectId.value);
        historyMachines.set(projectId.value, historyMachine);
    }

    // 是否有项目状态可以恢复
    const canRecover = ref(false);
    const dataToRecover = ref<Awaited<ReturnType<HistoryMachine['init']>> | null>(null);

    // 初始化历史记录
    onMounted(async () => {
        const savedData = await historyMachine.init();
        await historyMachine.ready();
        if (savedData?.state) {
            dataToRecover.value = markRaw(savedData);
            canRecover.value = true;
        }
        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
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

    async function recoverSegment(source: WebCutSourceData, segment: WebCutSegment, railId: string) {
        const { sourceKey } = segment;
        const { type, fileId, url, text, sprite, meta } = source;
        const src = fileId ? `file:${fileId}` : url || text || '';
        await pushToPlayer(type as any, src, {
            id: sourceKey,
            rect: sprite.rect,
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
            audio: meta.audio,
            video: meta.video,
            // TODO text的处理比较复杂，需进一步研究，可能需要从seg上获取
            text: meta.text,
            autoFitRect: meta.autoFitRect,
            withRailId: railId,
            withSegmentId: segment.id,
        });
    }

    async function recoverHistory(historyState: WebCutProjectHistoryState) {
        // 先清空当前画布全部
        sources.value.forEach(({ clip, sprite }) => {
            canvas.value?.removeSprite(sprite);
            sprite.destroy();
            clip.destroy();
        });
        sources.value.clear();
        rails.value = [];
        clips.value = [];
        sprites.value = [];
        selected.value = [];
        current.value = null;
        cursorTime.value = 0;

        const sourcesMap = historyState.sources;
        for (const rail of historyState.rails) {
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

        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    }

    // 整个组件只能执行一次，避免重复执行
    let isRecovered = false;
    async function recover() {
        if (isRecovered) {
            return;
        }
        isRecovered = true;

        const projectState = dataToRecover.value;
        if (!projectState) {
            return;
        }

        const { aspectRatio, state } = projectState;
        await recoverHistory(state);
        if (aspectRatio) {
            updateByAspectRatio(aspectRatio);
        }
    }

    // 撤销操作
    async function undo() {
        const state = await historyMachine.undo();
        if (!state) {
            return;
        }
        await recoverHistory(state);
    }

    // 重做操作
    async function redo() {
        const state = await historyMachine.redo();
        if (!state) {
            return;
        }
        await recoverHistory(state);
    }

    // 清除历史记录
    async function clear() {
        await historyMachine.clear();
        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    }

    async function push() {
        await historyMachine.ready();
        const railsData = clone(rails.value);
        const sourcesData: any = {};
        for (const [key, source] of sources.value.entries()) {
            const meta = convertSource(source);
            sourcesData[key] = meta;
        }
        await historyMachine.push({ rails: railsData, sources: sourcesData });
        canUndo.value = historyMachine.canUndo();
        canRedo.value = historyMachine.canRedo();
    }

    return {
        push,
        undo,
        redo,
        clear,
        canUndo,
        canRedo,
        canRecover,
        recover,
    };
}
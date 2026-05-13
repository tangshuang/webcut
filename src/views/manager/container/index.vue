<script setup lang="ts">
import { onMounted, useSlots } from 'vue';
import ScrollBox from '../../../components/scroll-box/index.vue';
import { ref, watch, nextTick } from 'vue';
// @ts-ignore
import Draggable from "vue3-draggable";
import { useWebCutManager } from '../../../hooks/manager';
import Ticker from '../ticker/index.vue';
import Ruler from '../ruler/index.vue';
import Cursor from '../cursor/index.vue';
import AdjustableBox, { AdjustEventData } from '../../../components/adjustable-box/index.vue';
import { WebCutRail, WebCutSegment } from '../../../types';
import { Video } from '@vicons/carbon';
import { NIcon } from 'naive-ui';
import { useT } from '../../../i18n/hooks';
import { useWebCutContext, useWebCutPlayer } from '../../../hooks';
import { useWebCutHistory } from '../../../hooks/history';
import { useWebCutTransition } from '../../../hooks/transition';

export type WebCutManagerProps = {
    topBarColor?: string;
    railBgColor?: string;
    segmentBgColor?: string;
    segmentBorderColor?: string;
    segmentHandlerColor?: string;
    asideWidth?: number | string;
    /** 禁用空行，末尾不会有一段空的空间 */
    disableEmptyRail?: boolean;
    /** 轨道高度，默认60，注意，不包含gap，gap为4 */
    railHeight?: number;
    /** 禁用排序，默认false */
    disableSort?: boolean;
    /** 是否禁用segment的时间调整 */
    disableChangeTiming?: boolean;
    /** 根据rail信息来计算rail的高度 */
    calcRailHeightByType?: (rail: WebCutRail) => number;
};

const emit = defineEmits(['sort', 'resize']);
/** 最大高度，默认240，注意，包含了topbar，topbar高度为20，还包含topbar和轨道之间的gap，gap为4 */
const maxHeight = defineModel<number>('maxHeight', { default: 264 });
const props = defineProps<WebCutManagerProps>();

const { rails, manager, selected, current, sources, toggleSegment, unselectSegment, selectSegment, modules } = useWebCutContext();
const { resort } = useWebCutPlayer();
const slots = useSlots();
const { scroll1, scroll2, totalPx, timeToPx, pxToTime, pxOf1Frame, resetSegmentTime, applyMainVideoMagnet } = useWebCutManager();
const t = useT();
const { push: pushHistory } = useWebCutHistory();
const { syncTransitions } = useWebCutTransition();

const container = ref();

const showDragable = ref(true);
const dataList = ref<WebCutRail[]>([]);
const moveState = ref<any>({});
const dragState = ref<any>({});
const highlightedRailId = ref<string | null>(null);
const dragPreview = ref<{
    active: boolean;
    segment?: WebCutSegment;
    railId?: string;
    start?: number;
    width?: number;
    invalid?: boolean;
}>({ active: false });
const dragAssistPreview = ref<{
    active: boolean;
    railId?: string;
    start?: number;
    width?: number;
}>({ active: false });
const DRAG_ACTIVATE_DISTANCE_PX = 4;

function resetDragPreview() {
    dragPreview.value = {
        active: false,
        segment: undefined,
        railId: undefined,
        start: undefined,
        width: undefined,
        invalid: false,
    };
    dragAssistPreview.value = {
        active: false,
        railId: undefined,
        start: undefined,
        width: undefined,
    };
}

function getAdjacentSnapStartPx(
    segments: WebCutSegment[],
    newStartPx: number,
    widthPx: number,
    movingRight: boolean
) {
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const newEndPx = newStartPx + widthPx;
    const overlaps = sorted.filter((seg) => {
        const segStart = timeToPx(seg.start);
        const segEnd = timeToPx(seg.end);
        return !(newEndPx <= segStart || newStartPx >= segEnd);
    });
    if (!overlaps.length) {
        return null;
    }

    if (movingRight) {
        const blocker = overlaps.reduce((prev, cur) => {
            const prevStart = timeToPx(prev.start);
            const curStart = timeToPx(cur.start);
            return curStart < prevStart ? cur : prev;
        });
        return Math.max(0, timeToPx(blocker.start) - widthPx);
    }

    const blocker = overlaps.reduce((prev, cur) => {
        const prevEnd = timeToPx(prev.end);
        const curEnd = timeToPx(cur.end);
        return curEnd > prevEnd ? cur : prev;
    });
    return Math.max(0, timeToPx(blocker.end));
}

watch(() => rails.value?.length, (next, prev) => {
    if (next !== prev) {
        showDragable.value = false;
        dataList.value = [...(rails.value || [])].reverse();
        nextTick(() => {
            showDragable.value = true;
        });
    }
}, { immediate: true });

watch(() => dataList.value.length, updateManagerHeight);
onMounted(() => {
    updateManagerHeight();
});

function updateManagerHeight() {
    const topBarHeight = 20;
    const gap = 4;
    const defaultRailHeight = props.railHeight || 60;
    const totalRailsHeight = dataList.value.reduce((acc, cur) => {
        const regMod = findMatchExtensionPackConfig(cur);
        const height = regMod?.height || defaultRailHeight;
        return acc + height + gap;
    }, 0);
    // 这里gap + 2是为了确保滚动条可以被用户触发，如果没有这个处理，用户无法拖动滚动条
    const areaHeight = totalRailsHeight === 0 ? gap + 2 : totalRailsHeight - gap;
    const railsHeight = areaHeight + (props.disableEmptyRail ? 0 : gap + defaultRailHeight);
    const railsMaxHeight = maxHeight.value - topBarHeight - gap;
    // 240为最大高度，大于240时，轨道高度会自适应
    const finalHeight = Math.min(railsHeight, railsMaxHeight) + topBarHeight + gap;
    if (scroll2.value && typeof scroll2.value.setHeight === 'function') {
        scroll2.value.setHeight(finalHeight);
    }
    if (scroll1.value && typeof scroll1.value.setHeight === 'function') {
        scroll1.value.setHeight(finalHeight);
    }
}

function resizeManagerMaxHeight(h: number) {
    maxHeight.value = h;
    updateManagerHeight();
}

function handleMoveStart(segment: WebCutSegment) {
    moveState.value = {
        segment,
        start: timeToPx(segment.start),
        width: timeToPx(segment.end - segment.start),
        end: timeToPx(segment.end),
    };
}

function handleMoveLeft(data: { offsetX: number }, segment: WebCutSegment) {
    if (moveState.value.segment !== segment) {
        return;
    }

    const { offsetX } = data;
    const start = timeToPx(segment.start);
    let newStart = start + offsetX;
    const end = moveState.value.end;

    // 边界限制：不能拖出轨道左侧
    newStart = Math.max(0, newStart);

    // 边界限制：不能超过右侧边界
    newStart = Math.min(newStart, end - 10); // 10px最小宽度

    moveState.value.start = newStart;
    moveState.value.width = end - newStart;
}

function handleMoveRight(data: { offsetX: number }, segment: WebCutSegment) {
    if (moveState.value.segment !== segment) {
        return;
    }

    const { offsetX } = data;
    const end = timeToPx(segment.end);
    let newEnd = end + offsetX;
    const start = moveState.value.start;

    // 边界限制：不能小于左侧边界
    newEnd = Math.max(newEnd, start + 10); // 10px最小宽度

    moveState.value.end = newEnd;
    moveState.value.width = newEnd - start;
}

function handleMoveRelease(segment: WebCutSegment, rail: WebCutRail) {
    if (moveState.value.segment !== segment) {
        return;
    }
    const { start, end } = moveState.value;
    segment.start = pxToTime(start);
    segment.end = pxToTime(end);
    moveState.value = {};
    resetSegmentTime(segment);
    applyMainVideoMagnet();
    syncTransitions(rail);
    pushHistory({ title: '调整片段时长' });
    emit('resize', { segment, rail });
}

function canMoveLeft(_e: any, segment: WebCutSegment, rail: WebCutRail) {
    if (isDisableChangeTiming(rail)) {
        return false;
    }

    if (moveState.value.segment !== segment) {
        return false;
    }

    // 始终返回true，在handleMoving中处理边界限制
    return true;
}

function canMoveRight(_e: any, segment: WebCutSegment, rail: WebCutRail) {
    if (isDisableChangeTiming(rail)) {
        return false;
    }

    if (moveState.value.segment !== segment) {
        return false;
    }

    // 始终返回true，在handleMoving中处理边界限制
    return true;
}

function handleLeftClick(segment: WebCutSegment, rail: WebCutRail) {
    if (isDisableChangeTiming(rail)) {
        return false;
    }
    handleMoveStart(segment);
    if (!canMoveLeft({ offsetX: -pxOf1Frame.value }, segment, rail)) {
        return;
    }
    moveState.value.start -= pxOf1Frame.value;
    handleMoveRelease(segment, rail);
}

function handleRightClick(segment: WebCutSegment, rail: WebCutRail) {
    if (isDisableChangeTiming(rail)) {
        return false;
    }
    handleMoveStart(segment);
    if (!canMoveRight({ offsetX: pxOf1Frame.value }, segment, rail)) {
        return;
    }
    moveState.value.end += pxOf1Frame.value;
    handleMoveRelease(segment, rail);
}

function handleDragStart(segment: WebCutSegment) {
    dragState.value = {
        segment,
        start: timeToPx(segment.start),
        end: timeToPx(segment.end),
        width: timeToPx(segment.end - segment.start),
        activated: false,
    };
    resetDragPreview();
}

function handleDragging(data: AdjustEventData, segment: WebCutSegment, rail: WebCutRail) {
    if (dragState.value.segment !== segment) {
        return;
    }
    if (!dragState.value.activated) {
        const movedDistance = Math.hypot(data.offsetX || 0, data.offsetY || 0);
        if (movedDistance < DRAG_ACTIVATE_DISTANCE_PX) {
            return;
        }
        dragState.value.activated = true;
    }

    const { offsetX, pageY } = data;
    const start = timeToPx(segment.start);
    const segmentWidth = dragState.value.width;

    let newStart = start + offsetX;
    let newEnd = newStart + segmentWidth;

    // 边界限制：不能拖出轨道左侧
    newStart = Math.max(0, newStart);
    newEnd = newStart + segmentWidth;

    // 计算悬停轨道
    let targetRail: WebCutRail | null = rail;
    const railsContainer = container.value.querySelector('.webcute__manager__main__rails');
    if (railsContainer) {
        const railsElements = container.value.querySelectorAll('.webcute__manager__main__rail');
        let targetRailId: string | null = null;

        // 遍历所有轨道元素，判断鼠标位置
        railsElements.forEach((railEl: any, index: number) => {
            const rect = railEl.getBoundingClientRect();
            if (pageY >= rect.top && pageY <= rect.bottom) {
                // 找到对应的rail对象（注意reversedRails的顺序）
                const targetRail = dataList.value[index];
                if (targetRail.type === rail.type) {
                    targetRailId = targetRail.id;
                }
            }
        });

        // 更新高亮轨道
        if (targetRailId) {
            highlightedRailId.value = targetRailId;
            targetRail = rails.value.find(r => r.id === targetRailId) || null;
        }
        else {
            highlightedRailId.value = null;
            targetRail = rail;
        }
    }

    if (!targetRail || targetRail.type !== rail.type) {
        dragPreview.value = {
            active: true,
            segment,
            railId: highlightedRailId.value || rail.id,
            start: newStart,
            width: segmentWidth,
            invalid: true,
        };
        return;
    }

    const targetSegments = targetRail.segments.filter(s => s !== segment);
    let invalid = false;
    const finalStart = newStart;
    // 同轨道与跨轨道统一采用严格目标位置判定：放不下即无效，不自动吸附到其他空位
    const newStartTime = pxToTime(newStart);
    const newEndTime = pxToTime(newStart + segmentWidth);
    const overlap = targetSegments.some(seg => !(newStartTime >= seg.end || newEndTime <= seg.start));
    invalid = overlap;

    if (targetRail.id === rail.id && invalid) {
        const assistStart = getAdjacentSnapStartPx(targetSegments, newStart, segmentWidth, (data.offsetX || 0) >= 0);
        if (assistStart !== null) {
            dragAssistPreview.value = {
                active: true,
                railId: targetRail.id,
                start: assistStart,
                width: segmentWidth,
            };
        } else {
            dragAssistPreview.value = { active: false };
        }
    } else {
        dragAssistPreview.value = { active: false };
    }

    const finalEnd = finalStart + segmentWidth;

    dragState.value.start = finalStart;
    dragState.value.end = finalEnd;
    dragPreview.value = {
        active: true,
        segment,
        railId: targetRail.id,
        start: finalStart,
        width: segmentWidth,
        invalid,
    };
}

function handleDragEnd(data: AdjustEventData, segment: WebCutSegment, rail: WebCutRail) {
    if (dragState.value.segment !== segment) {
        return;
    }
    if (!dragState.value.activated) {
        dragState.value = {};
        highlightedRailId.value = null;
        resetDragPreview();
        return;
    }

    // 纯点击或极小抖动不应触发位置提交，避免误改位置
    if (Math.abs(data.offsetX) < 1 && Math.abs(data.offsetY) < 1) {
        dragState.value = {};
        highlightedRailId.value = null;
        resetDragPreview();
        return;
    }

    // 目标位置无效（红框）时，不提交任何位置变更
    if (dragPreview.value.invalid) {
        // 同轨道存在绿色候选框时，允许吸附到该位置
        if (dragAssistPreview.value.active && dragAssistPreview.value.railId === rail.id) {
            segment.start = pxToTime(dragAssistPreview.value.start || 0);
            segment.end = pxToTime((dragAssistPreview.value.start || 0) + (dragAssistPreview.value.width || 0));
            dragState.value = {};
            highlightedRailId.value = null;
            resetDragPreview();
            resetSegmentTime(segment);
            applyMainVideoMagnet();
            syncTransitions(rail);
            resort();
            pushHistory({ title: '移动片段' });
            emit('resize', { segment, rail });
        }
        else {
            dragState.value = {};
            highlightedRailId.value = null;
            resetDragPreview();
        }
        return;
    }

    const { start, end } = dragState.value;
    let finalStart = start;
    let finalEnd = end;
    let targetRail = rail;


    const isSegmentSelected = selected.value.some(item => item.segmentId === segment.id);

    // 检查是否需要移动到新轨道
    const targetRailId = dragPreview.value.railId || highlightedRailId.value;
    const newTargetRail = rails.value.find(r => r.id === targetRailId);
    // 只有相同类型的rail才允许移动
    if (targetRailId && newTargetRail && newTargetRail.type === rail.type) {
        if (!dragPreview.value.invalid && newTargetRail) {
            // 先取消选中，避免在移动之后其rail与真实的rail对应不上
            if (isSegmentSelected) {
                unselectSegment(segment.id, rail.id);
            }

            // 从原轨道移除segment
            const segmentIndex = rail.segments.indexOf(segment);
            if (segmentIndex > -1) {
                rail.segments.splice(segmentIndex, 1);
            }

            // 添加segment到目标轨道
            newTargetRail.segments.push(segment);
            targetRail = newTargetRail;
            // 重新选中该segment
            if (isSegmentSelected) {
                selectSegment(segment.id, targetRail.id);
            }

            // 更新source中的railId值
            const source = sources.value.get(segment.sourceKey);
            if (source) {
                source.railId = targetRail.id;
            }

            // // 如果原轨道没有segment了，就从rails中移除该轨道
            // if (rail.segments.length === 0) {
            //     const railIndex = rails.value.findIndex(r => r.id === rail.id);
            //     rails.value.splice(railIndex, 1);
            // }

            finalStart = start;
            finalEnd = end;
        }
    }
    // 更新segment时间信息（仅在有效拖放时提交）
    segment.start = pxToTime(finalStart);
    segment.end = pxToTime(finalEnd);

    // 重置状态
    dragState.value = {};
    highlightedRailId.value = null;
    resetDragPreview();

    resetSegmentTime(segment);
    applyMainVideoMagnet();
    syncTransitions(rail);
    syncTransitions(targetRail);
    resort();
    pushHistory({ title: '移动片段' });
    emit('resize', { segment, rail: targetRail });
}

function canMoveSegment(_e: any, segment: WebCutSegment, rail: WebCutRail) {
    if (isDisableChangeTiming(rail)) {
        return false;
    }

    if (dragState.value.segment !== segment) {
        return false;
    }

    // 始终返回true，在handleMoving中处理边界限制
    return true;
}

function handleClickSegment(item: WebCutSegment, rail: WebCutRail) {
    toggleSegment(item.id, rail.id);
}

function handleClickTransition(transition: any, rail: WebCutRail) {
    // 当点击transition时，更新current对象，设置transitionId和railId
    current.value = { railId: rail.id, transitionId: transition.id };
}

function findMatchExtensionPackConfig(rail: WebCutRail) {
    const regMod = [...modules.value.values()].find(module => module.managerConfig?.is(rail));
    if (regMod) {
        return regMod.managerConfig;
    }
}

function calcRailHeightByType(rail: WebCutRail) {
    const regMod = findMatchExtensionPackConfig(rail);
    if (typeof regMod?.height === 'number') {
        return regMod.height + 'px';
    }
    if (props.calcRailHeightByType) {
        const height = props.calcRailHeightByType(rail);
        return height ? height + 'px' : undefined;
    }
}

function isDisableChangeTiming(rail: WebCutRail) {
    if (props.disableChangeTiming) {
        return true;
    }
    const regMod = findMatchExtensionPackConfig(rail);
    if (regMod?.segment?.disableChangeTiming) {
        return true;
    }
    return false;
}

const exposes = {
    resizeManagerMaxHeight,
};
manager.value = exposes;
</script>

<template>
    <div class="webcut__manager" :style="{
        '--webcut-manager-top-bar-color': props.topBarColor,
        '--webcut-manager-rail-bg-color': props.railBgColor || 'var(--webcut-rail-bg-color)',
        '--webcut-manager-segment-bg-color': props.segmentBgColor || '#777',
        '--webcut-manager-segment-border-color': props.segmentBorderColor || 'var(--border-color)',
        '--webcut-manager-segment-handler-color': props.segmentHandlerColor || 'var(--webcut-grey-deep-color)',
        '--webcut-manager-aside-width': props.asideWidth && typeof props.asideWidth === 'number' ? props.asideWidth + 'px' : props.asideWidth,
    }" ref="container">
        <div class="webcut__manager__aside" v-if="slots['asideRail']">
            <scroll-box class="webcut__mananger__aside__scroll-box" ref="scroll1" y-placement="left">
                <div class="webcut__mananger__top-bar"></div>
                <Draggable v-model="dataList" class="webcut__mananger__aside__list" @update:model-value="emit('sort', dataList)" v-if="showDragable && !props.disableSort">
                    <template #item="{ item }">
                        <div class="webcute__manager__aside__rail" :style="{ '--rail-height': calcRailHeightByType(item) }">
                            <slot name="asideRail" :rail="item" :railIndex="dataList.indexOf(item)"></slot>
                        </div>
                    </template>
                </Draggable>
                <div class="webcut__mananger__aside__list" v-if="props.disableSort">
                    <div class="webcute__manager__aside__rail" undraggable v-for="item in dataList" :style="{ '--rail-height': calcRailHeightByType(item) }">
                        <slot name="asideRail" :rail="item" :railIndex="dataList.indexOf(item)"></slot>
                    </div>
                </div>
                <div class="webcute__manager__aside__rail webcute__manager__aside__rail--empty" v-if="!props.disableEmptyRail && rails.length === 0"></div>
                <slot name="asideFooter"></slot>
                <div class="webcut__mananger__footer-placeholder"></div>
            </scroll-box>
        </div>
        <div class="webcut__manager__main">
            <scroll-box class="webcut__manager__main__scroll-box" x-scrollable ref="scroll2" :content-width="totalPx + 10">
                <div class="webcut__mananger__top-bar"></div>
                <div class="webcute__manager__main__rails">
                    <div
                        v-for="(rail,railIndex) in dataList" :key="rail.id"
                        class="webcute__manager__main__rail"
                        :class="{
                            'webcute__manager__main__rail--highlighted': highlightedRailId === rail.id,
                            'webcute__manager__main__rail--locked': rail.locked,
                            'webcute__manager__main__rail--hidden': rail.hidden,
                        }"
                        :style="{ '--rail-height': calcRailHeightByType(rail) }"
                    >
                        <AdjustableBox
                            v-for="(item,segmentIndex) in rail.segments"
                            :key="item.id"
                            class="webcute__manager__main__rail-segment"
                            :class="{
                                'webcute__manager__main__rail-segment--selected': selected.some(i => i.segmentId === item.id && i.railId === rail.id),
                                'webcute__manager__main__rail-segment--current': current?.segmentId === item.id && current?.railId === rail.id,
                                'webcute__manager__main__rail-segment--drag-origin': dragPreview.active && dragPreview.segment === item,
                            }"
                            :style="{
                                '--segment-left': moveState.segment === item ? moveState.start + 'px' : timeToPx(item.start) + 'px',
                                '--segment-width': moveState.segment === item ? moveState.width + 'px' : (dragState.segment === item ? dragState.width + 'px' : timeToPx(item.end - item.start) + 'px')
                            }"
                            @left-move-start="handleMoveStart(item)"
                            @left-moving="handleMoveLeft($event, item)"
                            @left-move-end="handleMoveRelease(item, rail)"
                            @right-move-start="handleMoveStart(item)"
                            @right-moving="handleMoveRight($event, item)"
                            @right-move-end="handleMoveRelease(item, rail)"
                            @left-click="handleLeftClick(item, rail)"
                            @right-click="handleRightClick(item, rail)"
                            @move-start="handleDragStart(item)"
                            @moving="handleDragging($event, item, rail)"
                            @move-end="handleDragEnd($event, item, rail)"
                            @select="handleClickSegment(item, rail)"
                            :can-move-left="e => canMoveLeft(e, item, rail)"
                            :can-move-right="e => canMoveRight(e, item, rail)"
                            :can-move="e => canMoveSegment(e, item, rail)"
                            :disabled="isDisableChangeTiming(rail)"
                            :disable-middle-drag-shadow="true"
                        >
                            <slot name="mainSegment" :segment="item" :rail="rail" :segmentIndex="segmentIndex" :railIndex="railIndex" :segments="rail.segments"></slot>
                        </AdjustableBox>

                        <!-- 转场效果片段 -->
                        <div
                            v-for="(transition,transitionIndex) in rail.transitions"
                            :key="transition.id"
                            class="webcute__manager__main__rail-segment webcute__manager__main__rail-transition"
                            :class="{
                                'webcute__manager__main__rail-segment--current': current?.transitionId === transition.id && current?.railId === rail.id,
                            }"
                            :style="{
                                '--segment-left': timeToPx(transition.start) + 'px',
                                '--segment-width': timeToPx(transition.end - transition.start) + 'px'
                            }"
                            @click="handleClickTransition(transition, rail)"
                        >
                            <slot name="mainTransition" :transition="transition" :rail="rail" :railIndex="railIndex" :transitionIndex="transitionIndex"></slot>
                        </div>

                        <slot name="mainRailEnd" :rail="rail" :railIndex="railIndex"></slot>
                        <div
                            v-if="dragPreview.active && !!dragPreview.segment && !!dragPreview.railId && dragPreview.railId === rail.id"
                            class="webcute__manager__main__rail-segment webcute__manager__main__rail-segment--drag-preview"
                            :class="{ 'webcute__manager__main__rail-segment--drag-preview-invalid': dragPreview.invalid }"
                            :style="{
                                '--segment-left': (dragPreview.start || 0) + 'px',
                                '--segment-width': (dragPreview.width || 0) + 'px',
                            }"
                        ></div>
                        <div
                            v-if="dragAssistPreview.active && !!dragAssistPreview.railId && dragAssistPreview.railId === rail.id"
                            class="webcute__manager__main__rail-segment webcute__manager__main__rail-segment--drag-preview webcute__manager__main__rail-segment--drag-preview-assist"
                            :style="{
                                '--segment-left': (dragAssistPreview.start || 0) + 'px',
                                '--segment-width': (dragAssistPreview.width || 0) + 'px',
                            }"
                        ></div>
                    </div>
                    <div class="webcute__manager__main__rail webcute__manager__main__rail--empty" v-if="!props.disableEmptyRail && rails.length === 0">
                        <div class="webcute__manager__main__rail--empty__text">
                            <n-icon :component="Video" size="large"></n-icon>
                            <small>{{ t('选择一个视频，开始你的创作。') }}</small>
                        </div>
                    </div>
                    <slot name="mainRailsFooter"></slot>
                </div>
                <div class="webcut__mananger__footer-placeholder" v-if="rails.length > 0"></div>
                <Ruler class="webcut__manager__main__ruler" />
                <Ticker class="webcut__manager__main__ticker" />
                <Cursor class="webcut__manager__main__curosr" />
            </scroll-box>
        </div>
    </div>
</template>

<style scoped lang="less">
@height: 60px;
@gap: 4px;

.webcut__manager {
    width: 100%;
    display: flex;
    justify-content: center;

    .webcut-control-button + & {
        margin-top: 16px;
    }

    --webcut-manager-rail-height: @height;
    --webcut-manager-gap: @gap;
}
.webcut__mananger__top-bar {
    height: 20px;
    margin-bottom: @gap;
    background-color: var(--webcut-manager-top-bar-color);
    position: sticky;
    top: 0;
    z-index: 100;
}
.webcut__manager__aside {
    width: var(--webcut-manager-aside-width);
    position: relative;
    border-right: 1px solid var(--webcut-line-color);
    overflow: auto;
}
.webcut__manager__main {
    flex: 1;
    overflow: auto;
    position: relative;
    // 下面为timeline fixed准备
    transform: translate(0, 0);
    overflow: hidden;
}
.webcut__manager__main__scroll-box {
    height: 100%;
}
.webcute__manager__main__rails {
    display: flex;
    flex-direction: column;
    gap: @gap;
}
.webcut__mananger__footer-placeholder {
    height: 12px;
}
.webcute__manager__main__rail {
    position: relative;
    padding-left: 10px;
    height: var(--rail-height, @height);
    background-color: var(--webcut-manager-rail-bg-color);
    border-bottom-right-radius: 8px;
    border-top-right-radius: 8px;
    transition: all 0.2s ease;
}
.webcute__manager__main__rail--highlighted {
    background-color: var(--webcut-rail-hover-bg-color);
}
.webcute__manager__main__rail--locked::after {
    content: '';
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background-image: linear-gradient(
        45deg,
        var(--modal-color) 0, var(--modal-color) 25%, transparent 25%, transparent 50%,
        var(--modal-color) 50%, var(--modal-color) 75%, transparent 75%, transparent
    );
    background-size: 6px 6px;
    border-radius: 4px;
}
.webcute__manager__main__rail--hidden {
    opacity: .3;
    pointer-events: none;
}
.webcute__manager__main__rail--empty__text {
    height: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: flex-start;
    opacity: .4;
    padding-left: 18px;
}

.webcute__manager__main__rail-segment {
    position: absolute;
    left: calc(var(--segment-left) + 10px);
    width: var(--segment-width);
    box-sizing: border-box;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: @gap;
    border: 1px solid var(--webcut-manager-segment-border-color);
    background-color: var(--webcut-manager-segment-bg-color);
    border-radius: 8px;
    padding: 0 12px;

    :deep(.webcut-adjustable-box-handler) {
        background-color: var(--webcut-manager-segment-handler-color);
    }
}
.webcute__manager__main__rail-segment--drag-origin {
    opacity: .45;
    filter: saturate(.9);
}
.webcute__manager__main__rail-segment--drag-origin::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    pointer-events: none;
}
.webcute__manager__main__rail-segment--drag-preview {
    z-index: 1200;
    pointer-events: none;
    border-style: dashed;
    border-width: 2px;
    background-color: rgba(0, 180, 162, 0.18);
    border-color: rgba(0, 180, 162, 0.75);
    box-shadow: 0 0 0 1px rgba(0, 180, 162, 0.15) inset;
}
.webcute__manager__main__rail-segment--drag-preview-invalid {
    background-color: rgba(255, 120, 120, 0.18);
    border-color: rgba(255, 120, 120, 0.8);
    box-shadow: 0 0 0 1px rgba(255, 120, 120, 0.2) inset;
}
.webcute__manager__main__rail-segment--drag-preview-assist {
    background-color: rgba(40, 200, 130, 0.18);
    border-color: rgba(40, 200, 130, 0.85);
    box-shadow: 0 0 0 1px rgba(40, 200, 130, 0.22) inset;
}
.webcute__manager__main__rail-segment--selected {
    border-color: var(--primary-color);
}
.webcute__manager__main__rail-segment--current::after {
    content: '';
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 6px;
    z-index: 10;
    border: 3px solid var(--primary-color);
    pointer-events: none;
}
.webcut__mananger__aside__list {
    display: flex;
    flex-direction: column;
    gap: @gap;
}
.webcute__manager__aside__rail {
    height: var(--rail-height, @height);
    background-color: var(--webcut-manager-rail-bg-color);
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0 1em;
    margin-left: 4px;
}
.webcute__manager__main__rail-transition {
    background-color: var(--webcut-theme-opacity-color);
    z-index: 999;
    padding: 0;
    border: 0;
}
</style>

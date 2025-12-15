<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NIcon } from 'naive-ui';
import { Add } from '@vicons/carbon';
import { useT } from '../../hooks/i18n';
import { useWebCutContext } from '../../hooks';
import ScrollBox from '../../components/scroll-box/index.vue';
import { useWebCutToast } from '../../hooks/toast';
import { transitionManager } from '../../modules/transitions';
import { WebCutTransitionData } from '../../types';
import { clone, createRandomString } from 'ts-fns';
import { useWebCutTransition } from '../../hooks/transition';
import TransitionIcon from '../../components/sprite-image/transition-icon.vue';

const transitionDefaults = transitionManager.getTransitionDefaults();
const t = useT();
const transitionPresets = Object.values(transitionDefaults);
const { current, rails } = useWebCutContext();
const { applyTransition } = useWebCutTransition();
const toast = useWebCutToast();

// 左侧菜单状态，只保留"默认"
const actionType = ref<'default'>('default');

// 转场效果点击事件
const handleTransitionClick = async (transitionName: string) => {
    if (!current.value) {
        toast.error(t('请先选择一个片段'));
        return;
    }

    const { segmentId, railId } = current.value;
    const rail = rails.value.find(r => r.id === railId);
    if (!rail) {
        toast.error(t('轨道不存在'));
        return;
    }

    if (rail.type !== 'video' && rail.type !== 'image') {
        toast.error(t('仅支持视频和图片'));
        return;
    }

    const segmentIndex = rail.segments.findIndex(s => s.id === segmentId);
    if (segmentIndex === -1) {
        toast.error(t('片段不存在'));
        return;
    }

    const currentSegment = rail.segments[segmentIndex];
    const nextIndex = segmentIndex + 1;
    const nextSegment = rail.segments[nextIndex];
    if (!nextSegment) {
        toast.error(t('当前片段是轨道最后一个片段，不能应用转场效果'));
        return;
    }

    // 应用转场效果
    const defaults = transitionDefaults[transitionName];
    const { defaultDuration = 2e6, defaultConfig } = defaults;
    const transition: WebCutTransitionData = {
        id: createRandomString(16),
        name: transitionName,
        start: currentSegment.end - defaultDuration / 2,
        end: currentSegment.end + defaultDuration / 2,
        config: clone(defaultConfig || {}),
    };

    // 检查是否存在时间重叠的转场
    const isOverlapping = rail.transitions.some(existingTransition => {
        // 检查新转场的时间范围是否与现有转场重叠
        return !(transition.end <= existingTransition.start || transition.start >= existingTransition.end);
    });
    if (isOverlapping) {
        toast.error(t('已经存在视频转场，请先删除'));
        return;
    }

    // 创建转场 Sprite 渲染到画布
    await applyTransition(rail, transition);
};

function readTransitionTitle(transitionName: string) {
    return t(transitionDefaults[transitionName]?.title || transitionName);
}
</script>

<template>
    <div class="webcut-library-panel">
        <!-- 左侧菜单栏 -->
        <aside class="webcut-library-panel-aside">
            <div class="webcut-library-panel-aside-btn"
                :class="{ 'webcut-library-panel-aside-btn--active': actionType === 'default' }">{{ t('默认') }}</div>
        </aside>

        <!-- 右侧转场列表 -->
        <main class="webcut-library-panel-main">
            <ScrollBox class="webcut-material-container">
                <div class="webcut-material-list">
                    <div v-for="transition in transitionPresets" :key="transition.name" class="webcut-material-item">
                        <div class="webcut-material-preview">
                            <!-- 转场效果预览图标 -->
                            <TransitionIcon class="webcut-transition-preview-icon" :name="transition.name"></TransitionIcon>
                            <!-- 添加按钮 -->
                            <n-button class="webcut-add-button" size="tiny" type="primary" circle
                                @click.stop="handleTransitionClick(transition.name)">
                                <template #icon>
                                    <n-icon :component="Add"></n-icon>
                                </template>
                            </n-button>
                        </div>
                        <div class="webcut-material-title">
                            {{ readTransitionTitle(transition.name) }}
                        </div>
                    </div>
                    <div v-if="transitionPresets.length === 0" class="webcut-empty-materials">
                        {{ t('暂无转场效果') }}
                    </div>
                </div>
            </ScrollBox>
        </main>
    </div>
</template>

<style scoped lang="less">
@import "../../styles/library.less";
</style>

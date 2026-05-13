<script setup lang="ts">
import WebCutManagerScaler from '../scaler/index.vue';
import AddRailButton from '../add-rail-button.vue';
import RefreshTool from '../../tools/refresh/index.vue';
import ClearTool from '../../tools/clear/index.vue';
import DeleteTool from '../../tools/delete/index.vue';
import SplitTool from '../../tools/split/index.vue';
import SplitKeepLeft from '../../tools/split-keep-left/index.vue';
import SplitKeepRight from '../../tools/split-keep-right/index.vue';
import FlipH from '../../tools/flip-h/index.vue';
import Concat from '../../tools/concat/index.vue';
import Undo from '../../tools/undo/index.vue';
import Redo from '../../tools/redo/index.vue';
import HistoryList from '../../tools/history-list/index.vue';
import MagnetTool from '../../tools/magnet/index.vue';
import { DividerTall16Regular } from '@vicons/fluent';
import Loading from '../../loading/index.vue';
import { NIcon } from 'naive-ui';

const props = defineProps<{
    asideWidth?: number | string;
}>();
</script>

<template>
    <div class="webcut-manager-tools-bar" :style="{
        '--webcut-manager-aside-width': props.asideWidth && typeof props.asideWidth === 'number' ? props.asideWidth + 'px' : props.asideWidth,
    }">
        <div class="webcut-manager-tools-bar-left">
            <span style="margin-left:2px"></span>
            <AddRailButton />
            <span style="margin:auto"></span>
            <Loading size="1.2em"></Loading>
            <span style="margin-right:2px"></span>
        </div>
        <div class="webcut-manager-tools-bar-right">
            <RefreshTool></RefreshTool>
            <HistoryList />
            <Undo></Undo>
            <Redo></Redo>
            <n-icon :component="DividerTall16Regular" class="webcut-divider-icon"></n-icon>
            <ClearTool></ClearTool>
            <n-icon :component="DividerTall16Regular" class="webcut-divider-icon"></n-icon>
            <DeleteTool></DeleteTool>
            <SplitTool></SplitTool>
            <SplitKeepLeft></SplitKeepLeft>
            <SplitKeepRight></SplitKeepRight>
            <FlipH></FlipH>
            <n-icon :component="DividerTall16Regular" class="webcut-divider-icon"></n-icon>
            <Concat></Concat>
            <slot name="middle"></slot>
            <span style="margin:auto"></span>
            <slot name="right"></slot>
            <MagnetTool></MagnetTool>
            <WebCutManagerScaler></WebCutManagerScaler>
        </div>
    </div>
</template>

<style scoped>
.webcut-manager-tools-bar {
    display: flex;
    align-items: center;
    height: 28px;
    border-bottom: 1px solid var(--webcut-line-color);
}
.webcut-manager-tools-bar-left {
    width: var(--webcut-manager-aside-width);
    height: 100%;
    padding: 0;
    border-right: 1px solid var(--webcut-line-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    box-sizing: border-box;
}
.webcut-manager-tools-bar-right {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    padding: 4px;
    margin-right: 8px;
    margin-left: 4px;
    border-bottom: 1px solid var(--webcut-line-color);
}
.webcut-divider-icon {
    font-size: var(--webcut-font-size-large);
    opacity: .1;
}
</style>

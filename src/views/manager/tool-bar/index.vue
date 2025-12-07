<script setup lang="ts">
import WebCutManagerScaler from '../scaler/index.vue';
import ClearTool from '../../tools/clear/index.vue';
import DeleteTool from '../../tools/delete/index.vue';
import SplitTool from '../../tools/split/index.vue';
import SplitKeepLeft from '../../tools/split-keep-left/index.vue';
import SplitKeepRight from '../../tools/split-keep-right/index.vue';
import FlipH from '../../tools/flip-h/index.vue';
import Concat from '../../tools/concat/index.vue';
import Undo from '../../tools/undo/index.vue';
import Redo from '../../tools/redo/index.vue';
</script>

<template>
    <div class="webcut-manager-tools-bar">
        <div class="webcut-manager-tools-bar-left">
            <slot name="left"></slot>
        </div>
        <div class="webcut-manager-tools-bar-right">
            <Undo></Undo>
            <Redo></Redo>
            <ClearTool></ClearTool>
            <DeleteTool></DeleteTool>
            <SplitTool></SplitTool>
            <SplitKeepLeft></SplitKeepLeft>
            <SplitKeepRight></SplitKeepRight>
            <FlipH></FlipH>
            <Concat></Concat>
            <slot name="middle"></slot>
            <span style="margin:auto"></span>
            <slot name="right"></slot>
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
    width: 120px;
    height: 100%;
    border-right: 1px solid var(--webcut-line-color);
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
</style>
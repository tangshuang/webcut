<script setup lang="ts">
import { useWebCutContext } from '../../hooks';
import TextSetting from './text/index.vue';
import ScrollBox from '../../components/scroll-box/index.vue';
import BasicSetting from './basic/index.vue';
import { ref, watch } from 'vue';

const { currentRail, currentSegment } = useWebCutContext();
const tab = ref('basic');

watch(currentSegment, () => {
    tab.value = 'basic';
});
</script>

<template>
  <div class="webcut-panel">
    <div class="webcut-panel-header" v-if="currentRail">
      <div class="webcut-panel-tabs">
        <div class="webcut-panel-tab" v-if="['text', 'image', 'video'].includes(currentRail?.type!)" :class="{'webcut-panel-tab--active': tab === 'basic'}" @click="tab = 'basic'">
          基础
        </div>
        <div class="webcut-panel-tab" v-if="currentRail?.type === 'text'" :class="{'webcut-panel-tab--active': tab === 'text'}" @click="tab = 'text'">
          文本
        </div>
      </div>
    </div>
    <div class="webcut-panel-content" v-if="currentRail">
      <ScrollBox>
        <BasicSetting v-if="tab === 'basic'" />
        <TextSetting v-if="tab === 'text'" />
      </ScrollBox>
    </div>
  </div>
</template>

<style scoped>
.webcut-panel {
  height: 100%;
  font-size: 0.8em;
  display: flex;
  flex-direction: column;
}

.webcut-panel-content {
  flex: 1;
  overflow: auto;
}

.webcut-panel-tabs {
  display: flex;
  background-color: var(--webcut-thumb-color);
  margin: 8px;
  border-radius: 4px;
}
.webcut-panel-tab {
  padding: 2px 16px;
  margin: 2px;
  border-radius: 4px;
  cursor: pointer;
}
.webcut-panel-tab--active {
  background-color: var(--webcut-grey-deep-color);
}

.webcut-panel :deep(.webcut-panel-form) {
  padding: 8px;
  width: calc(100% - 16px);
}
</style>

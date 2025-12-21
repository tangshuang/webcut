<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWebCutLibrary } from '../../../hooks/library';
import ScrollBox from '../../../components/scroll-box/index.vue';
import { useWebCutPlayer } from '../../../hooks';
import { useWebCutHistory } from '../../../hooks/history';
import { WebCutThingType, WebCutMaterialType } from '../../../types';

import Aside from './aside.vue';
import ImportBox from './import.vue';
import List from './list.vue';

const emit = defineEmits(['leaveListItem', 'enterListItem', 'clickListItem']);
const props = defineProps<{
  thingType: WebCutThingType;
  materialType: WebCutMaterialType;
  accept: string;
  disableDefaultNavs?: string[];
  supportsDirectoryUpload?: boolean;
}>();

const { push } = useWebCutPlayer();
const { projectFiles, files, addNewFile } = useWebCutLibrary();
const { push: pushHistory } = useWebCutHistory();

const allFileList = computed(() => {
  const items = files.value.filter((file) => file.type.startsWith(props.thingType)).sort((a, b) => (b.time || 0) - (a.time || 0));
  return items;
});
const projectFileList = computed(() => {
  const items = projectFiles.value.filter((file) => file.type.startsWith(props.thingType)).sort((a, b) => (b.time || 0) - (a.time || 0));
  return items;
});

const actionType = ref<string>('this');
const selectedNav = ref<any>(null);

async function handleFileChange(e: any) {
  const file = e.file.file;
  await addNewFile(file);
  actionType.value = 'this';
}

async function handleAdd(material: any) {
  try {
    const { id } = material;
    await push('audio', `file:${id}`);
    await pushHistory();
  }
  catch (e) {
    console.error(e);
  }
}
</script>

<template>
  <div class="webcut-library-panel">
    <Aside v-model:current="actionType" :selected="selectedNav" :thingType="props.thingType" :disableDefaultNavs="props.disableDefaultNavs"></Aside>

    <!-- 右侧素材列表 -->
    <main class="webcut-library-panel-main">
      <ImportBox
        v-if="actionType === 'import'"
        v-model:current="actionType"
        :thingType="props.thingType"
        :accept="props.accept"
        :supportsDirectoryUpload="props.supportsDirectoryUpload"
      ></ImportBox>

      <scroll-box class="webcut-material-container" v-if="actionType === 'this'">
        <List
          :files="projectFileList"
          :thingType="props.thingType"
          :materialType="props.materialType"
          @clickItem="emit('clickListItem', $event)"
          @leaveItem="emit('leaveListItem', $event)"
          @enterItem="emit('enterListItem', $event)"
        >
          <template #preview="{ file }">
            <slot name="listItemPreview" :file="file"></slot>
          </template>
          <template #default="{ file }">
            <slot name="listItemContent" :file="file"></slot>
          </template>
        </List>
      </scroll-box>

      <scroll-box class="webcut-material-container" v-if="actionType === 'all'">
        <List
          :files="allFileList"
          :thingType="props.thingType"
          :materialType="props.materialType"
          disableContextMenu
          @clickItem="emit('clickListItem', $event)"
          @leaveItem="emit('leaveListItem', $event)"
          @enterItem="emit('enterListItem', $event)"
        >
          <template #preview="{ file }">
            <slot name="listItemPreview" :file="file"></slot>
          </template>
          <template #default="{ file }">
            <slot name="listItemContent" :file="file"></slot>
          </template>
        </List>
      </scroll-box>

      <scroll-box class="webcut-material-container" v-if="selectedNav?.component">
        <component
          :is="selectedNav.component"
          :allFiles="allFileList"
          :projectFiles="projectFileList"
          :onAdd="handleAdd"
          :onFileChange="handleFileChange"
        ></component>
      </scroll-box>
    </main>
  </div>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>
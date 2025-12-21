<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWebCutLibrary } from '../../../hooks/library';
import ScrollBox from '../../../components/scroll-box/index.vue';
import { useWebCutPlayer } from '../../../hooks';
import { useWebCutHistory } from '../../../hooks/history';
import { WebCutThingType, WebCutMaterialType, WebCutMaterial } from '../../../types';

import Aside, { Nav } from './aside.vue';
import ImportBox from './import.vue';
import List from './list.vue';

export type WebCutLibarayNavComponentProps = {
  allFiles: WebCutMaterial[];
  projectFiles: WebCutMaterial[];
  onMaterialAdd: typeof onMaterialAdd;
  onFileChange: typeof onFileChange;
  onNavSwitch: typeof onNavSwitch;
  onResetNav: typeof onResetNav;
};

const emit = defineEmits(['leaveListItem', 'enterListItem', 'clickListItem']);
const props = defineProps<{
  thingType: WebCutThingType;
  materialType: WebCutMaterialType;
  accept: string;
  navs?: Nav[];
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

const navKey = ref<string>('');
const selectedNav = ref<any>(null);
const asideRef = ref();

async function onFileChange(file: File) {
  await addNewFile(file);
}

async function onMaterialAdd(material: WebCutMaterial) {
  try {
    const { id } = material;
    await push(material.type, `file:${id}`);
    await pushHistory();
  }
  catch (e) {
    console.error(e);
  }
}

function onNavSwitch(nav: any) {
  navKey.value = nav.key;
  selectedNav.value = nav;
}

function onResetNav() {
  asideRef.value?.resetToFirstNav();
}
</script>

<template>
  <div class="webcut-library-panel">
    <Aside
      v-model:current="navKey"
      v-model:selected="selectedNav"
      :thingType="props.thingType"
      :navs="props.navs"
      ref="asideRef"
    ></Aside>

    <!-- 右侧素材列表 -->
    <main class="webcut-library-panel-main">
      <ImportBox
        v-if="navKey === 'import'"
        v-model:current="navKey"
        :thingType="props.thingType"
        :accept="props.accept"
        :supportsDirectoryUpload="props.supportsDirectoryUpload"
        @fileImport="asideRef?.resetToFirstNav"
        @dirImport="asideRef?.resetToFirstNav"
      ></ImportBox>

      <scroll-box class="webcut-material-container" v-if="navKey === 'this'">
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

      <scroll-box class="webcut-material-container" v-if="navKey === 'all'">
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
          :onMaterialAdd="onMaterialAdd"
          :onFileChange="onFileChange"
          :onNavSwitch="onNavSwitch"
          :onResetNav="onResetNav"
        ></component>
      </scroll-box>
    </main>
  </div>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>
<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import {
  NButton,
  NIcon,
  NUpload,
  NUploadDragger,
  NDropdown,
} from 'naive-ui';
import { Add, Upload } from '@vicons/carbon';
import { useWebCutLibrary } from '../../hooks/library';
import ScrollBox from '../../components/scroll-box/index.vue';
import { useWebCutPlayer } from '../../hooks';
import { useWebCutLocalFile } from '../../hooks/local-file';
import { useT } from '../../hooks/i18n';
import { useWebCutHistory } from '../../hooks/history';

const t = useT();

const { push } = useWebCutPlayer();
const { projectFiles, files, addNewFile, removeFile } = useWebCutLibrary();
const { fileUrl } = useWebCutLocalFile();
const { push: pushHistory } = useWebCutHistory();

const allImageList = computed(() => {
  const items = files.value.filter((file) => file.type.startsWith('image/')).sort((a, b) => (b.time || 0) - (a.time || 0));
  return items;
});
const projectImageList = computed(() => {
  const items = projectFiles.value.filter((file) => file.type.startsWith('image/')).sort((a, b) => (b.time || 0) - (a.time || 0));
  return items;
});



const actionType = ref<'import' | 'this' | 'all'>('this');

// 右键菜单相关状态
const showDropdown = ref(false);
const x = ref(0);
const y = ref(0);
const currentFile = ref<any>(null);

// 右键菜单选项
const options = computed(() => [
  {
    label: t('删除'),
    key: 'delete'
  }
]);

async function handleFileChange(e: any) {
  const file = e.file.file;
  await addNewFile(file);
  actionType.value = 'this';
}

// 处理右键菜单点击
function handleContextMenu(e: MouseEvent, file: any) {
  e.preventDefault();
  showDropdown.value = false;
  currentFile.value = file;
  nextTick().then(() => {
    showDropdown.value = true;
    x.value = e.clientX;
    y.value = e.clientY;
  });
}

// 处理菜单项选择
function handleSelect(key: string | number) {
  showDropdown.value = false;
  if (key === 'delete' && currentFile.value) {
    removeFile(currentFile.value.id);
  }
}

// 点击外部关闭菜单
function onClickoutside() {
  showDropdown.value = false;
}

async function handleAdd(material: any) {
  try {
    const { id } = material;
    await push('image', `file:${id}`, { autoFitRect: 'contain' });
    await pushHistory();
  }
  catch (e) {
    console.error(e);
  }
}
</script>

<template>
  <div class="webcut-library-panel">
    <aside class="webcut-library-panel-aside">
      <div class="webcut-library-panel-aside-btn" :class="{ 'webcut-library-panel-aside-btn--active': actionType === 'this' }" @click="actionType = 'this'">{{ t('当前') }}</div>
      <div class="webcut-library-panel-aside-btn" :class="{ 'webcut-library-panel-aside-btn--active': actionType === 'import' }" @click="actionType = 'import'">{{ t('导入') }}</div>
      <div class="webcut-library-panel-aside-btn" :class="{ 'webcut-library-panel-aside-btn--active': actionType === 'all' }" @click="actionType = 'all'">{{ t('全部') }}</div>
    </aside>

    <!-- 右侧素材列表 -->
    <main class="webcut-library-panel-main">
      <div class="webcut-meterial-panel-upload" v-if="actionType === 'import'">
        <n-upload multiple :show-file-list="false" accept=".jpg,.jpeg,.png,.gif,.webp" @change="handleFileChange">
          <n-upload-dragger>
            <div>
              <n-icon :component="Upload" size="large"></n-icon>
            </div>
            <div>{{ t('拖拽图片到这里') }}</div>
            <div><small>{{ t('或者点击上传') }}</small></div>
          </n-upload-dragger>
        </n-upload>
      </div>

      <scroll-box class="webcut-material-container" v-if="actionType === 'this'">
        <div class="webcut-material-list">
          <div v-for="file in projectImageList" :key="file.id" class="webcut-material-item"
            @contextmenu.stop="handleContextMenu($event, file)">
            <div class="webcut-material-preview">
              <img :src="fileUrl(file.id)" class="webcut-material-image" />
              <n-button class="webcut-add-button" size="tiny" type="primary" circle @click="handleAdd(file)">
                <template #icon>
                  <n-icon>
                    <Add />
                  </n-icon>
                </template>
              </n-button>
            </div>
            <div class="webcut-material-title">
              {{ file.name }}
            </div>
          </div>
          <div v-if="projectImageList.length === 0" class="webcut-empty-materials">
            {{ t('暂无素材，请先导入素材') }}
          </div>
        </div>
      </scroll-box>

      <scroll-box class="webcut-material-container" v-if="actionType === 'all'">
        <div class="webcut-material-list">
          <div v-for="file in allImageList" :key="file.id" class="webcut-material-item">
            <div class="webcut-material-preview">
              <img :src="fileUrl(file.id)" class="webcut-material-image" />
              <n-button class="webcut-add-button" size="tiny" type="primary" circle @click="handleAdd(file)">
                <template #icon>
                  <n-icon>
                    <Add />
                  </n-icon>
                </template>
              </n-button>
            </div>
            <div class="webcut-material-title">
              {{ file.name }}
            </div>
          </div>
          <div v-if="allImageList.length === 0" class="webcut-empty-materials">
            {{ t('暂无素材，请先导入素材') }}
          </div>
        </div>
      </scroll-box>
    </main>
  </div>

  <!-- 右键菜单组件 -->
  <n-dropdown placement="bottom-start" trigger="manual" :x="x" :y="y" :options="options" :show="showDropdown"
    :on-clickoutside="onClickoutside" size="small" @select="handleSelect" />
</template>

<style scoped lang="less">
@import "../../styles/library.less";
</style>
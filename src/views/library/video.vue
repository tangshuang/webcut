<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import {
  NButton,
  NIcon,
  NUpload,
  NUploadDragger,
  NDropdown,
  NSpin,
} from 'naive-ui';
import { Add, Upload } from '@vicons/carbon';
import { useWebCutLibrary } from '../../hooks/library';
import ScrollBox from '../../components/scroll-box/index.vue';
import { useWebCutPlayer } from '../../hooks';
import { useWebCutLocalFile } from '../../hooks/local-file';
import { useT } from '../../hooks/i18n';
import { useWebCutHistory } from '../../hooks/history';
import { PerformanceMark, mark } from '../../libs/performance';
import { loadFFmpeg, transcodeToMP4ByFFmpeg } from '../../libs/ffmpeg';

// 定义进度事件类型
interface ProgressEvent {
  progress: number;
  time: number;
}

// 定义日志事件类型
interface LogEvent {
  type: string;
  message: string;
}

const t = useT();

const { push } = useWebCutPlayer();
const { projectFiles, files, addNewFile, removeFile } = useWebCutLibrary();
const { fileUrl } = useWebCutLocalFile();
const { push: pushHistory } = useWebCutHistory();

const allVideoList = computed(() => {
  const items = files.value.filter((file) => file.type.startsWith('video/')).sort((a, b) => (b.time || 0) - (a.time || 0));
  return items;
});
const projectVideoList = computed(() => {
  const items = projectFiles.value.filter((file) => file.type.startsWith('video/')).sort((a, b) => (b.time || 0) - (a.time || 0));
  return items;
});

const actionType = ref<'import' | 'this' | 'all'>('this');

// 转码相关状态
const isTranscoding = ref(false);
const transcodingProgress = ref(0);

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

// 检查文件是否为MP4格式
function isMP4Format(file: File): boolean {
  // 检查MIME类型
  if (file.type === 'video/mp4') {
    return true;
  }

  // 检查文件扩展名
  const fileName = file.name.toLowerCase();
  return fileName.endsWith('.mp4');
}

// 将ArrayBuffer转换为File对象
function arrayBufferToFile(buffer: ArrayBuffer, originalFile: File): File {
  const blob = new Blob([buffer], { type: 'video/mp4' });
  const fileName = originalFile.name.replace(/\.[^/.]+$/, '.mp4');
  return new File([blob], fileName, { type: 'video/mp4' });
}

async function handleFileChange(e: any) {
  const file = e.file.file;

  try {
    // 检查是否为MP4格式
    if (isMP4Format(file)) {
      // 如果是MP4格式，直接添加
      await addNewFile(file);
    } else {
      // 如果不是MP4格式，进行转码
      isTranscoding.value = true;
      transcodingProgress.value = 0;

      // 加载FFmpeg
      const ffmpeg = await loadFFmpeg((event: ProgressEvent | LogEvent) => {
        // 区分是进度事件还是日志事件
        if (event && 'progress' in event && typeof event.progress === 'number') {
          // 进度事件
          transcodingProgress.value = (event as ProgressEvent).progress * 0.5; // 加载进度占50%
        } else if (event && 'message' in event) {
          // 日志事件
          console.log('FFmpeg加载日志:', (event as LogEvent).message);
        }
      });

      // 转码为MP4
      const transcodedBuffer = await transcodeToMP4ByFFmpeg(file, ffmpeg, (event: ProgressEvent | LogEvent) => {
        // 区分是进度事件还是日志事件
        if (event && 'progress' in event && typeof event.progress === 'number') {
          // 进度事件
          transcodingProgress.value = 50 + (event as ProgressEvent).progress * 0.5; // 转码进度占50%
        } else if (event && 'message' in event) {
          // 日志事件
          console.log('FFmpeg转码日志:', (event as LogEvent).message);
        }
      });

      // 将转码后的ArrayBuffer转换为File对象
      const mp4File = arrayBufferToFile(transcodedBuffer, file);

      // 添加转码后的文件
      await addNewFile(mp4File);

      isTranscoding.value = false;
      transcodingProgress.value = 0;
    }

    actionType.value = 'this';
  } catch (error) {
    console.error('文件处理失败:', error);
    isTranscoding.value = false;
    transcodingProgress.value = 0;
    // 可以在这里添加错误提示
  }
}

function handleClickVideo(e: any) {
  const video = e.target as HTMLVideoElement;
  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
}

function onLeaveVideo(e: any) {
  const video = e.target as HTMLVideoElement;
  video.pause();
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
    mark(PerformanceMark.PushVideoStart);
    const { id } = material;
    await push('video', `file:${id}`, { autoFitRect: 'contain' });
    mark(PerformanceMark.PushVideoEnd);
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
        <n-upload multiple :show-file-list="false" accept="video/*,.mkv" @change="handleFileChange" :disabled="isTranscoding">
          <n-upload-dragger>
            <div v-if="isTranscoding">
              <n-spin size="large" />
              <div style="margin-top: 8px;">{{ t('正在转码为MP4格式...') }}</div>
              <div style="margin-top: 4px; font-size: 12px;">{{ Math.round(transcodingProgress) }}%</div>
            </div>
            <div v-else>
              <n-icon :component="Upload" size="large"></n-icon>
            </div>
            <div v-if="!isTranscoding">{{ t('拖拽视频到这里') }}</div>
            <div v-if="!isTranscoding"><small>{{ t('或者点击上传') }}</small></div>
          </n-upload-dragger>
        </n-upload>
      </div>

      <scroll-box class="webcut-material-container" v-if="actionType === 'this'">
        <div class="webcut-material-list">
          <div v-for="material in projectVideoList" :key="material.id" class="webcut-material-item" @contextmenu.stop="handleContextMenu($event, material)">
            <div class="webcut-material-preview">
              <video :src="fileUrl(material.id)" v-if="fileUrl(material.id)" class="webcut-material-video" @click="handleClickVideo" @mouseleave="onLeaveVideo"></video>
              <n-button class="webcut-add-button" size="tiny" type="primary" circle @click="handleAdd(material)">
                <template #icon>
                  <n-icon>
                    <Add />
                  </n-icon>
                </template>
              </n-button>
            </div>
            <div class="webcut-material-title">
              {{ material.name }}
            </div>
          </div>
          <div v-if="projectVideoList.length === 0" class="webcut-empty-materials">
            {{ t('暂无素材，请先导入素材') }}
          </div>
        </div>
      </scroll-box>

      <scroll-box class="webcut-material-container" v-if="actionType === 'all'">
        <div class="webcut-material-list">
          <div v-for="material in allVideoList" :key="material.id" class="webcut-material-item">
            <div class="webcut-material-preview">
              <video :src="fileUrl(material.id)" v-if="fileUrl(material.id)" class="webcut-material-video" @click="handleClickVideo"></video>
              <n-button class="webcut-add-button" size="tiny" type="primary" circle @click="handleAdd(material)">
                <template #icon>
                  <n-icon>
                    <Add />
                  </n-icon>
                </template>
              </n-button>
            </div>
            <div class="webcut-material-title">
              {{ material.name }}
            </div>
          </div>
          <div v-if="allVideoList.length === 0" class="webcut-empty-materials">
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
.webcut-library-panel {
  display: flex;
  height: 100%;
  margin: 0 4px;
}

.webcut-library-panel-aside {
  width: 60px;
  min-width: 60px;
}

.webcut-library-panel-aside-btn {
  background: var(--webcut-grey-deep-color);
  margin: 2px;
  border-radius: 4px;
  font-size: var(--webcut-font-size-tiny);
  padding: 2px 4px;
  cursor: pointer;
  white-space: nowrap;

  &--active {
    background-color: var(--webcut-grey-color);
  }
}

.webcut-library-panel-main {
  flex: 1;
  margin-left: 8px;
}

.webcut-material-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 16px;
}

.webcut-material-item {
  width: 100px;
}

.webcut-material-item:hover .webcut-material-preview {
  box-shadow: 0 0 4px var(--webcut-grey-deep-color);
}

.webcut-material-item .webcut-material-preview video {
  transition: transform 0.3s ease;
}

.webcut-material-item:hover .webcut-material-preview video {
  transform: scale(1.05);
}

.webcut-material-preview {
  width: 100px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--webcut-grey-deep-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
}

.webcut-material-title {
  font-size: var(--webcut-font-size-tiny);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
}

.webcut-material-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.webcut-add-button {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  z-index: 10;
  opacity: 0;
  transition: all 0.3s ease;
}

.webcut-material-item:hover .webcut-add-button {
  opacity: 1;
}

.webcut-empty-materials {
  margin-top: 12px;
  margin-left: 24px;
  font-size: var(--webcut-font-size-tiny);
  opacity: .6;
}

.webcut-material-container {
  height: 100%;
  overflow: auto;
}
</style>

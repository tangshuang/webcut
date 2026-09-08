<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { NModal, NIcon } from 'naive-ui';
import { Close } from '@vicons/carbon';
import { useWebCutLocalFile } from '../../../hooks/local-file';
import { useT } from '../../../i18n/hooks';
import { WebCutMaterial, WebCutMaterialType } from '../../../types';

const props = defineProps<{
    show: boolean;
    file: WebCutMaterial | null;
    materialType: WebCutMaterialType;
}>();
const emit = defineEmits(['update:show']);

const t = useT();
const { applyFileUrl } = useWebCutLocalFile();
const url = ref('');

// 类型标签文案：视频 / 图片 / 音频
const typeLabel = computed(() => {
    if (props.materialType === 'video') {
        return t('视频');
    }
    if (props.materialType === 'image') {
        return t('图片');
    }
    return t('音频');
});

watch(
    () => [props.show, props.file?.id],
    async () => {
        if (!props.show) {
            url.value = '';
            return;
        }
        if (props.file?.id) {
            try {
                url.value = await applyFileUrl(props.file.id);
            }
            catch (err) {
                // 读取失败时保持弹窗可用（仅标题栏），避免 unhandled rejection
                console.error('[WebCut] preview applyFileUrl failed', err);
                url.value = '';
            }
        }
    },
    { immediate: true }
);
</script>

<template>
  <n-modal
    :show="props.show"
    @update:show="emit('update:show', $event)"
    :z-index="20000"
    content-class="webcut-material-preview-modal"
  >
    <div class="webcut-material-preview-modal-wrap">
      <!-- 关闭按钮：位于方框外部右上角 -->
      <button
        class="webcut-material-preview-modal-close"
        type="button"
        @click="emit('update:show', false)"
      >
        <n-icon :size="18">
          <Close />
        </n-icon>
      </button>

      <div class="webcut-material-preview-modal-body">
        <div class="webcut-material-preview-modal-title">
          <span class="webcut-material-preview-modal-name">{{ props.file?.name }}</span>
          <span class="webcut-material-preview-modal-type">{{ typeLabel }}</span>
        </div>
        <div class="webcut-material-preview-modal-media">
          <video
            v-if="props.materialType === 'video' && url"
            :src="url"
            class="webcut-material-preview-modal-video"
            controls
            autoplay
          ></video>
          <img
            v-else-if="props.materialType === 'image' && url"
            :src="url"
            class="webcut-material-preview-modal-image"
          ></img>
          <div v-else-if="props.materialType === 'audio' && url" class="webcut-material-preview-modal-audio-box">
            <audio :src="url" class="webcut-material-preview-modal-audio" controls autoplay></audio>
          </div>
          <!-- 加载占位：url 就绪前保持正常弹窗尺寸，避免只剩标题条 -->
          <div v-else-if="props.file" class="webcut-material-preview-modal-loading">
            {{ t('加载中') }}
          </div>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<style scoped lang="less">
.webcut-material-preview-modal-wrap {
  position: relative;
  width: fit-content;
  max-width: 90vw;
}

.webcut-material-preview-modal-close {
  position: absolute;
  top: -38px;
  right: 0;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.28);
    color: #fff;
  }
}

// 容器宽高跟随素材自适应（上限：宽 90vw，含标题栏总高 90vh），素材贴边填满
.webcut-material-preview-modal-body {
  display: flex;
  flex-direction: column;
  width: fit-content;
  max-width: 90vw;
  background-color: #16161a;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  overflow: hidden;
}

.webcut-material-preview-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.82);
}

.webcut-material-preview-modal-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.webcut-material-preview-modal-type {
  flex-shrink: 0;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.55);
}

.webcut-material-preview-modal-media {
  min-height: 0;
  background-color: #0a0a0c;
}

.webcut-material-preview-modal-video,
.webcut-material-preview-modal-image {
  display: block;
  width: auto;
  height: auto;
  max-width: 90vw;
  max-height: calc(90vh - 42px);
}

// 音频：无视觉内容，固定宽度卡片 + 上下留白的播放器
.webcut-material-preview-modal-audio-box {
  width: min(90vw, 560px);
  padding: 48px 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.webcut-material-preview-modal-audio {
  width: 100%;
}

// 加载占位：保证弹窗打开即为正常尺寸卡片
.webcut-material-preview-modal-loading {
  width: min(90vw, 560px);
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}
</style>

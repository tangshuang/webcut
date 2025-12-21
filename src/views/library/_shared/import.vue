<script setup lang="ts">
import { onMounted } from 'vue';
import {
    NButton,
    NIcon,
    NUpload,
    NUploadDragger,
    NSpin,
} from 'naive-ui';
import { Upload } from '@vicons/carbon';
import { useWebCutLibrary } from '../../../hooks/library';
import { useT } from '../../../i18n/hooks';
import { WebCutThingType } from '../../../types';
import { loadFFmpeg, transcodeToMP4ByFFmpeg } from '../../../libs/ffmpeg';

const emit = defineEmits(['fileImported', 'dirImported']);
const actionType = defineModel('current', { default: 'this' });
// 上传中的文件列表
const uploadingFiles = defineModel<Set<string>>('uploadingFiles', { default: new Set() });
// 转码相关状态
const isTranscoding = defineModel('isTranscoding', { default: false });
const transcodingProgress = defineModel('transcodingProgress', { default: 0 });

const props = defineProps<{
    thingType: WebCutThingType;
    accept: string;
    supportsDirectoryUpload?: boolean;
}>();

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
const { addNewFile } = useWebCutLibrary();

onMounted(() => {
    // 初始化FFmpeg
    setTimeout(loadFFmpeg, 2000);
});

async function handleFileChange(e: any) {
    actionType.value = 'this';
    // 调用新的handleFile函数处理文件
    await importOneFile(e.file.file);
    emit('fileImported', e.file.file);
}

// 处理文件夹导入
async function handleImportFolder() {
    try {
        // 打开文件夹选择器
        const directoryHandle = await window.showDirectoryPicker();

        // 递归扫描文件夹中的所有视频文件
        const files: File[] = [];
        await scanDirectory(directoryHandle, files);

        // 按文件名排序
        files.sort((a, b) => a.name.localeCompare(b.name));

        // 立即切换到当前项目tab
        actionType.value = 'this';

        // 逐一上传视频文件
        for (const file of files) {
            await importOneFile(file);
        }

        emit('dirImported', files);
    } catch (error) {
        console.error('文件夹导入失败:', error);
    }

    // 递归扫描文件夹
    async function scanDirectory(directoryHandle: FileSystemDirectoryHandle, files: File[]) {
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                // 检查是否为视频文件
                if (filterFilesByAccept([file], props.accept).length > 0) {
                    files.push(file);
                }
            } else if (entry.kind === 'directory') {
                // 递归扫描子文件夹
                await scanDirectory(entry, files);
            }
        }
    }
    /**
     * 筛选符合 accept 规则的 File 对象
     * @param {File[]} fileList - 待筛选的 File 对象数组（严格类型约束）
     * @param {string} accept - 筛选规则（同 input[type=file] 的 accept 属性，多个规则用逗号分隔）
     * @returns {File[]} 符合规则的 File 对象数组
     */
    function filterFilesByAccept(fileList: File[], accept: string): File[] {
      // 处理空值情况，严格类型判断
      if (!fileList || fileList.length === 0 || typeof accept !== 'string' || accept.trim() === '') {
        return [...fileList];
      }

      // 1. 解析 accept 规则，转为统一的匹配规则数组
      const acceptRules = accept
        .split(',')
        .map(rule => rule.trim())
        .filter((rule): rule is string => !!rule); // 类型守卫，确保过滤后为非空字符串

      const mimeRules: string[] = []; // 存储 MIME 类型规则（如 image/*、application/pdf）
      const extRules: string[] = [];  // 存储后缀名规则（如 jpg、png，统一转为小写）

      acceptRules.forEach(rule => {
        const lowerCaseRule = rule.toLowerCase();
        if (lowerCaseRule.startsWith('.')) {
          // 处理后缀名规则（如 .jpg → jpg）
          extRules.push(lowerCaseRule.slice(1));
        } else if (lowerCaseRule.includes('/')) {
          // 处理 MIME 类型规则（如 image/jpeg、image/*）
          mimeRules.push(lowerCaseRule);
        }
      });

      // 2. 定义单个文件是否符合规则的判断函数（严格类型校验）
      const isFileAcceptable = (file: File): boolean => {
        const fileMime = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();
        const fileExt = fileName.split('.').pop() ?? ''; // 空值合并，避免 undefined

        // 优先匹配 MIME 类型规则
        if (mimeRules.length > 0) {
          for (const mimeRule of mimeRules) {
            if (mimeRule === '*/*') {
              // 通配符匹配所有类型
              return true;
            } else if (mimeRule.endsWith('/*')) {
              // 匹配 MIME 大类（如 image/* 匹配所有图片类型）
              const mimeCategory = mimeRule.slice(0, mimeRule.indexOf('/*'));
              if (fileMime.startsWith(`${mimeCategory}/`)) {
                return true;
              }
            } else if (mimeRule === fileMime) {
              // 精确匹配 MIME 类型
              return true;
            }
          }
        }

        // 匹配后缀名规则
        if (extRules.length > 0 && extRules.includes(fileExt)) {
          return true;
        }

        // 无匹配规则
        return false;
      };

      // 3. 筛选符合规则的文件（严格类型校验）
      return fileList.filter(file => file instanceof File && isFileAcceptable(file));
    }
}


// 处理单个文件上传（复用原逻辑）
async function importOneFile(file: File) {
    if (props.thingType === 'video') {
        await importVideo(file);
    }
    else {
        await addNewFile(file);
    }
}

async function importVideo(file: File) {
    try {
        // 将文件添加到上传中列表
        uploadingFiles.value.add(file.name);

        // 检查是否为MP4格式
        if (isMP4Format(file)) {
            // 如果是MP4格式，直接添加
            await addNewFile(file);
        }
        else {
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
    } catch (error) {
        console.error('文件处理失败:', error);
        isTranscoding.value = false;
        transcodingProgress.value = 0;
    } finally {
        // 从上传中列表移除文件
        uploadingFiles.value.delete(file.name);
    }


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
}
</script>

<template>
    <div class="webcut-meterial-panel-upload">
        <n-upload multiple :show-file-list="false" :accept="props.accept" @change="handleFileChange"
            :disabled="isTranscoding">
            <n-upload-dragger>
                <div v-if="isTranscoding">
                    <n-spin size="large" />
                    <div style="margin-top: 8px;">{{ t('正在转码...') }}</div>
                    <div style="margin-top: 4px; font-size: 12px;">{{ Math.round(transcodingProgress) }}%</div>
                </div>
                <div v-else>
                    <n-icon :component="Upload" size="large"></n-icon>
                </div>
                <div v-if="!isTranscoding">{{ t('拖拽到这里') }}</div>
                <div v-if="!isTranscoding"><small>{{ t('或者点击上传') }}</small></div>
            </n-upload-dragger>
        </n-upload>

        <div style="margin-top: 16px; text-align: center;" v-if="props.supportsDirectoryUpload">
            <n-button type="default" @click="handleImportFolder" :disabled="isTranscoding" text size="small">
                <small>{{ t('导入文件夹') }}</small>
            </n-button>
        </div>
    </div>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>

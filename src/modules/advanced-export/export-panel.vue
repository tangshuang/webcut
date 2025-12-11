<script setup lang="ts">
import { computed, ref } from 'vue';
import {
    NForm,
    NFormItem,
    NSelect,
    NDivider,
    NButton,
    NSwitch,
} from 'naive-ui';
import { WebCutExportVideoParams, WebCutExportAudioParams } from './types';
import { useWebCutContext, useWebCutPlayer } from '../../hooks';
import { useT } from '../../hooks/i18n';
import { aspectRatioMap, aspectRatio720PMap, aspectRatio480PMap, aspectRatio360PMap } from '../../constants';
import { calcAspectRatio, resampleAudioWithOfflineContext, saveAsFile } from '../../libs';

const t = useT();
const { fps, canvas, width, height } = useWebCutContext();
const { exportAsWavBlob } = useWebCutPlayer();

const isExporting = ref(false);
const exportMessage = ref('');
const exportStatus = ref<'default' | 'success' | 'error'>('default');

const exportType = ref<'video' | 'audio'>('video');
const videoData = ref<WebCutExportVideoParams>({
    format: 'mp4',
    resolution: '1080P',
    fps: fps.value,
    videoBitrate: 5000000,
    audioBitrate: 128000,
    audio: true,
    codec: 'avc1.4d4028',
});
const audioData = ref<WebCutExportAudioParams>({
    format: 'wav',
    bitrate: 128000,
    sampleRate: 48000,
});

const codecOptions = computed(() => {
    if (exportType.value === 'video' && videoData.value.format === 'mp4') {
        return [
            { label: 'H.264 (High)', value: 'avc1.640034' },
            { label: 'H.264 (Main)', value: 'avc1.4d4028' },
            { label: 'H.264 (Baseline)', value: 'avc1.42E032' },
            { label: 'VP9 (Profile 0)', value: 'vp09.00.40.08' },
            { label: 'VP9 (Profile 1)', value: 'vp09.00.10.08' },
            { label: 'H.265 (HEVC)', value: 'hvc1' },
        ];
    }
    else if (exportType.value === 'video' && videoData.value.format === 'webm') {
        return [
            { label: 'VP9 (Opus)', value: 'vp9,opus' },
            { label: 'VP8 (Opus)', value: 'vp8,opus' },
        ];
    }
});

async function handleExport() {
    try {
        // 开始导出
        isExporting.value = true;
        exportMessage.value = t('正在导出...');
        exportStatus.value = 'default';

        if (exportType.value === 'video') {
            const { format } = videoData.value;
            if (format === 'mp4') {
                await exportMP4();
            }
            else {
                await exportWebM();
            }
        }
        else if (exportType.value === 'audio') {
            if (audioData.value.format === 'm4a') {
                await exportM4A();
            }
            else if (audioData.value.format === 'wav') {
                await exportWAV();
            }
        }

        // 导出成功
        exportStatus.value = 'success';
        exportMessage.value = t('导出完成！');
    }
    catch (error) {
        console.error('Export failed:', error);
        exportStatus.value = 'error';
        exportMessage.value = t('导出失败：') + (error as Error).message;
    }
    finally {
        isExporting.value = false;
    }
}

async function exportMP4() {
    const size = calcVideoSize();
    const combiner = await canvas.value!.createCombinator({
        ...size,
        videoBitrate: videoData.value.videoBitrate,
        fps: videoData.value.fps,
        videoCodec: videoData.value.codec,
        // @ts-ignore
        audio: videoData.value.audio,
    });

    const readable = combiner.output();
    await saveAsFile(readable, { type: 'video/mp4', name: `webcut-${Date.now()}.mp4` });
}

async function exportWebM() {
    const mediaStream = canvas.value!.captureStream();
    const mimeType = getSupportedMimeType(videoData.value.codec);
    const recorder = new MediaRecorder(mediaStream, {
        mimeType,
        videoBitsPerSecond: videoData.value.videoBitrate,
        audioBitsPerSecond: videoData.value.audioBitrate,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
                console.log('收到数据块:', event.data.size, 'bytes');
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(blob);
        };

        recorder.onerror = (event) => {
            reject(event.error);
        };

        recorder.start(1000);
    });

    await saveAsFile(blob, { type: 'video/webm', name: `webcut-${Date.now()}.webm` });
}

async function exportM4A() {
    const combiner = await canvas.value!.createCombinator({
        width: 0,
        height: 0,
        // @ts-ignore
        audio: true,
        videoCodec: 'avc1.42E032',
    });
    const readable = combiner.output();
    await saveAsFile(readable, { type: 'audio/mp4', name: `webcut-${Date.now()}.m4a` });
}

async function exportWAV() {
    let wavBlob = await exportAsWavBlob();
    if (audioData.value.sampleRate !== 48000) {
        wavBlob = await resampleAudioWithOfflineContext(wavBlob, audioData.value.sampleRate as 44100);
    }
    await saveAsFile(wavBlob, { type: 'audio/wav', name: `webcut-${Date.now()}.wav` });
}

function getSupportedMimeType(highPriority: string): string {
    if (MediaRecorder.isTypeSupported(highPriority)) {
        return highPriority;
    }

    const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }

    throw new Error('浏览器不支持 WebM 导出');
}

function calcVideoSize() {
    const aspectRatio = calcAspectRatio(width.value, height.value, aspectRatioMap);
    const aspectRatioMaps = {
        '1080P': aspectRatioMap,
        '720P': aspectRatio720PMap,
        '480P': aspectRatio480PMap,
        '360P': aspectRatio360PMap,
    };
    const map = aspectRatioMaps[videoData.value.resolution];
    const size = map[aspectRatio];
    return size;
}
</script>

<template>
    <n-form label-placement="left" label-width="120px" label-align="left" size="small"
        class="webcut-form webcut-export-form webcut-form--small">
        <section>
            <div class="webcut-export-previewer"></div>
        </section>
        <section class="webcut-export-form-items">
            <n-form-item :label="t('导出类型')">
                <n-select v-model:value="exportType" :options="[
                    { label: t('视频'), value: 'video' },
                    { label: t('音频'), value: 'audio' }
                ]" size="tiny" />
            </n-form-item>

            <n-divider></n-divider>

            <section v-if="exportType === 'video'">
                <n-form-item :label="t('输出格式')">
                    <n-select v-model:value="videoData.format" :options="[
                        { label: 'MP4', value: 'mp4' },
                        // { label: 'WebM', value: 'webm' },
                    ]" size="tiny" />
                </n-form-item>

                <n-form-item :label="t('分辨率')" v-if="videoData.format === 'mp4'">
                    <n-select v-model:value="videoData.resolution"
                        :options="['1080P', '720P', '480P', '360P'].map(value => ({ label: value, value }))"
                        size="tiny" />
                </n-form-item>

                <n-form-item :label="t('帧率')" v-if="videoData.format === 'mp4'">
                    <n-select v-model:value="videoData.fps" :options="[
                        { label: '15 fps', value: 15 },
                        { label: '24 fps', value: 24 },
                        { label: '30 fps', value: 30 },
                        { label: '60 fps', value: 60 },
                    ]" size="tiny" />
                </n-form-item>

                <n-form-item :label="t('视频比特率')">
                    <n-select v-model:value="videoData.videoBitrate" :options="[
                        { label: '1 Mbps', value: 1e6 },
                        { label: '2 Mbps', value: 2e6 },
                        { label: '5 Mbps', value: 5e6 },
                        { label: '10 Mbps', value: 10e6 }
                    ]" size="tiny" />
                </n-form-item>

                <n-divider></n-divider>

                <n-form-item :label="t('编码格式')">
                    <n-select v-model:value="videoData.codec" :options="codecOptions" size="tiny" />
                </n-form-item>

                <n-form-item :label="t('包含音频')" :feedback="t('关闭时将导出无声音的视频')" v-if="videoData.format === 'mp4'">
                    <n-switch v-model:value="videoData.audio" />
                </n-form-item>


                <n-form-item :label="t('音频比特率')" v-if="videoData.format === 'webm'">
                    <n-select v-model:value="videoData.audioBitrate" :options="[
                        { label: '64 kbps', value: 64000 },
                        { label: '128 kbps', value: 128000 },
                        { label: '192 kbps', value: 192000 },
                        { label: '256 kbps', value: 256000 },
                        { label: '320 kbps', value: 320000 }
                    ]" size="tiny" />
                </n-form-item>
            </section>

            <section v-if="exportType === 'audio'">
                <n-form-item :label="t('输出格式')">
                    <n-select v-model:value="audioData.format" :options="[
                        // { label: 'MP3', value: 'mp3' },
                        { label: 'WAV', value: 'wav' },
                        { label: 'M4A', value: 'm4a' },
                    ]" size="tiny" />
                </n-form-item>

                <n-form-item :label="t('比特率')">
                    <n-select v-model:value="audioData.bitrate" :options="[
                        // { label: '64 kbps', value: 64000 },
                        { label: '128 kbps', value: 128000 },
                        // { label: '192 kbps', value: 192000 },
                        // { label: '256 kbps', value: 256000 },
                        // { label: '320 kbps', value: 320000 }
                    ]" size="tiny" />
                </n-form-item>

                <n-form-item :label="t('采样率')" v-if="audioData.format === 'wav'">
                    <n-select v-model:value="audioData.sampleRate" :options="[
                        { label: '44.1 kHz', value: 44100 },
                        { label: '48 kHz', value: 48000 }
                    ]" size="tiny" />
                </n-form-item>
            </section>

            <n-divider style="margin-top: 0"></n-divider>

            <div class="webcut-export-form-buttons">
                <n-button type="primary" @click="handleExport" :loading="isExporting" :disabled="isExporting">
                    {{ isExporting ? t('导出中...') : t('开始导出') }}
                </n-button>
                <slot name="buttons" :isExporting="isExporting"></slot>
            </div>

            <div class="webcut-export-form-progress" v-if="exportMessage">
                <small>{{ exportMessage }}</small>
            </div>
        </section>
    </n-form>
</template>

<style scoped lang="less">
@import "../../styles/form.less";

.webcut-export-form {
    background-color: var(--webcut-background-color);
    padding: 32px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}

.webcut-export-form-items {
    flex: 1;
}

.webcut-export-form-buttons {
    width: 100%;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.webcut-export-form-progress {
    width: 100%;
    margin-top: 16px;
    text-align: center;
}
</style>

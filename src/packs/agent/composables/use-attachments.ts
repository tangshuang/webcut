import { ref, computed } from 'vue';
import type { WebCutAgentAdapter, WebCutAgentUploadedFile } from '../adapter';

/**
 * 附件上传 composable：管理用户上传的图片/视频/音频文件。
 * - 调 adapter.uploadFile 上传到服务端，返回 {fileId, url, type, name}；
 * - 上传后加入列表，可作为 mention 候选项 + clips bar 展示；
 * - 删除/预览通过 fileId 操作；
 * - 提交时只引用 fileId（不重传文件）。
 */
export function useAttachments(adapter: WebCutAgentAdapter | null) {
    const uploadedFiles = ref<WebCutAgentUploadedFile[]>([]);
    const isUploading = ref(false);

    async function upload(file: File): Promise<WebCutAgentUploadedFile | null> {
        if (!adapter?.uploadFile) return null;
        // 仅接受 image/video/audio
        const kind = inferKind(file.type);
        if (!kind) return null;
        isUploading.value = true;
        try {
            const result = await adapter.uploadFile(file);
            if (result?.fileId) {
                uploadedFiles.value.push(result);
            }
            return result;
        } catch {
            return null;
        } finally {
            isUploading.value = false;
        }
    }

    function removeUpload(fileId: string) {
        const idx = uploadedFiles.value.findIndex((f) => f.fileId === fileId);
        if (idx >= 0) uploadedFiles.value.splice(idx, 1);
    }

    /** 清空全部 */
    function clear() {
        uploadedFiles.value = [];
    }

    return {
        uploadedFiles,
        isUploading,
        upload,
        removeUpload,
        clear,
    };
}

function inferKind(mime: string): 'image' | 'video' | 'audio' | null {
    if (!mime) return null;
    const m = mime.toLowerCase();
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('audio/')) return 'audio';
    return null;
}

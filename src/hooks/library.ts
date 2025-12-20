import { computed, watch } from 'vue';
import { getProject, addFile, addFileToProject, removeFileFromProject, getAllFiles, addFileTags } from '../db';
import { useWebCutContext } from './index';
import { source } from 'fods';
import { useSource } from 'fods-vue';
import { getFileMd5 } from '../libs/file';
import { WebCutProjectData, WebCutMaterial } from '../types';

const getProjectData = source((projectId: string) => getProject(projectId));
const getFiles = source<WebCutMaterial[], []>(async () => {
    const allFiles = await getAllFiles();
    return allFiles;
});

export function useWebCutLibrary() {
    const { id: projectId, loading } = useWebCutContext();
    const { data: projectData, init: initProjectData, refresh: refreshProjectData } = useSource(getProjectData, {} as WebCutProjectData);
    const { data: files, init: initFiles, refresh: refreshFiles } = useSource(getFiles, []);

    // 项目的文件列表
    const projectFiles = computed(() => {
        const fileMetas = projectData.value?.files || [];
        const items = fileMetas.map((item) => {
            const { id, time } = item;
            const file: any = files.value.find((file: any) => file.id === id);
            if (file) {
                return {
                    ...file,
                    // 使用添加到项目中的时间，覆盖文件元数据中的时间，按照项目中的时间进行排序
                    time,
                };
            }
        }).filter(Boolean);
        items.sort((a, b) => (b.time || 0) - (a.time || 0));
        return items;
    });

    watch(projectId, () => {
        if (!projectId.value) {
            return;
        }
        initProjectData(projectId.value);
        initFiles();
    }, { immediate: true });

    async function addNewFile(file: File, tags?: string[]) {
        loading.value = true;
        try {
            let fileId = await getFileMd5(file);
            if (projectFiles.value.some((item: any) => item.id === fileId)) {
                return;
            }
            if (!files.value.some((item: any) => item.id === fileId)) {
                await addFile(file, tags);
            }
            // 若文件已存在，且tags不为空，则添加tags
            else if (tags) {
                await addFileTags(fileId, tags);
            }
            await addFileToProject(projectId.value, fileId);
            await refreshProjectData();
            await refreshFiles();
        } finally {
            loading.value = false;
        }
    }

    async function removeFile(fileId: string) {
        loading.value = true;
        try {
            await removeFileFromProject(projectId.value, fileId);
            await refreshProjectData();
            await refreshFiles();
        } finally {
            loading.value = false;
        }
    }

    return {
        projectId,
        projectData,
        projectFiles,
        files,
        addNewFile,
        removeFile,
    };
}

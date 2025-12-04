// @ts-ignore
import InDB from 'indb'; // https://github.com/tangshuang/indb
import { write, file } from 'opfs-tools'; // https://github.com/hughfenghen/opfs-tools
import { createRandomString } from 'ts-fns';
import { getFileMd5 } from '../libs/file';
import { AsyncQueue } from '../libs/async-queue';
import { WebCutHistoryState, WebCutRail, WebCutSourceMeta } from '../types';

const queue = new AsyncQueue();

// 初始化 InDB 实例
const idb = new InDB({
    name: 'webcut',
    version: 6,
    stores: [
        {
            name: 'file',
            primaryKeyPath: 'id',
            indexes: [
                {
                    name: 'id',
                    keyPath: 'id',
                    unique: true,
                }
            ]
        },
        {
            name: 'project',
            primaryKeyPath: 'id',
            indexes: [
                {
                    name: 'id',
                    keyPath: 'id',
                    unique: true,
                }
            ]
        },
        {
            name: 'history',
            primaryKeyPath: 'id',
            indexes: [
                {
                    name: 'id',
                    keyPath: 'id',
                    unique: true,
                },
                {
                    name: 'projectId',
                    keyPath: 'projectId',
                }
            ]
        },
        {
            name: 'project_state',
            isKv: true,
        },
    ],
});

// 获取 files 存储实例
const filesStorage = idb.use('file');

// 获取 projects 存储实例
const projectsStorage = idb.use('project');

// 获取 history 存储实例
const historyStorage = idb.use('history');

const projectStateStorage = idb.use('project_state');

export async function getProject(projectId: string) {
    if (!projectId) {
        return null;
    }

    const projectData = await projectsStorage.get(projectId);
    if (!projectData) {
        return null;
    }

    // 兼容旧版本
    if (!projectData.files && projectData.fileIds) {
        projectData.files = projectData.fileIds.map((id: string) => ({ id, time: Date.now() }));
        delete projectData.fileIds;
    }

    const projectFileMetas = projectData.files || [];
    const projectFileIds = projectFileMetas.map((item: any) => item.id);
    const projectFiles = await filesStorage.query('id', projectFileIds, 'in');
    const projectFileMap = projectFiles.reduce((acc: any, item: any) => {
        acc[item.id] = item;
        return acc;
    }, {});

    projectData.files = projectFileMetas.map((item: any) => ({
        ...projectFileMap[item.id],
        time: item.time,
    })).reverse();

    return projectData;
}

export async function createNewProject(id?: string) {
    const projectId = id || createRandomString(16);
    const projectData = {
        id: projectId,
        name: `新项目 ${projectId}`,
        files: [],
    };
    await projectsStorage.put(projectData);
    return projectId;
}

export async function addFileToProject(projectId: string, fileId: string) {
    let projectData = await projectsStorage.get(projectId);
    if (!projectData) {
        await createNewProject(projectId);
        projectData = await getProject(projectId);
    }

    // 兼容旧版本
    if (!projectData.files && projectData.fileIds) {
        projectData.files = projectData.fileIds.map((id: string) => ({ id, time: Date.now() }));
        delete projectData.fileIds;
    }

    projectData.files.push({
        id: fileId,
        time: Date.now(),
    });

    await projectsStorage.put(projectData);
    return projectData;
}

export async function removeFileFromProject(projectId: string, fileId: string) {
    let projectData = await projectsStorage.get(projectId);
    if (!projectData) {
        return null;
    }
    if (!projectData.files.some((item: any) => item.id === fileId)) {
        return null;
    }
    projectData.files = projectData.files.filter((item: any) => item.id !== fileId);
    await projectsStorage.put(projectData);
    return projectData;
}

export async function writeFile(file: File) {
    const fileId = await getFileMd5(file);
    const opfsFilePath = `/webcut/file/${fileId}`;
    await queue.push(() => write(opfsFilePath, file.stream(), { overwrite: true }));
    return fileId;
}

export async function readFile(fileId: string) {
    const opfsFilePath = `/webcut/file/${fileId}`;
    const fileCtx = file(opfsFilePath);
    if (await fileCtx.exists()) {
        const outfile = await fileCtx.getOriginFile();
        return outfile;
    }
    return null;
}

export async function addFile(file: File) {
    const fileId = await writeFile(file);
    const fileData = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        time: Date.now(),
    };
    await filesStorage.put(fileData);
    return fileId;
}

export async function getFile(fileId: string): Promise<File> {
    const fileData = await filesStorage.get(fileId);
    if (!fileData) {
        throw new Error('文件不存在');
    }
    return fileData;
}

export async function getAllFiles() {
    const files = await filesStorage.all();
    return files.reverse();
}

/**
 * 移动项目的历史记录指针
 * @param projectId 项目ID
 * @param to 移动方向，-1 表示上一个历史记录，即Undo，1 表示下一个历史记录，即Redo
 * @returns 移动后的历史记录数据
 */
export async function moveProjectHistoryTo(projectId: string, to: -1 | 1) {
    const projectState = await getProjectState(projectId);
    const projectHistory = await getProjectHistory(projectId);
    const historyAt = projectState.historyAt || '';

    let index = projectHistory.length - 1;
    if (historyAt) {
        index = projectHistory.findIndex((item: any) => item.id === historyAt);
    }
    index = Math.max(0, index);

    const next = index + to;
    const nextHistory = projectHistory[next];
    if (!nextHistory) {
        return null;
    }

    const nextHistoryAt = nextHistory.id;
    await setProjectState(projectId, { historyAt: nextHistoryAt });

    return nextHistory;
}

// 保存历史记录
export async function pushProjectHistory(projectId: string, state: WebCutHistoryState) {
    if (!projectId || !state) {
        return null;
    }

    const projectData = await projectsStorage.get(projectId);
    if (!projectData) {
        return null;
    }

    const historyId = createRandomString(16);
    const historyData = {
        id: historyId,
        projectId,
        timestamp: Date.now(),
        state,
    };

    const prevAt = projectData.historyAt;
    if (prevAt) {
        const projectHistory: any[] = await getProjectHistory(projectId);
        const prev = projectHistory.find((item: any) => item.id === prevAt);
        if (prev) {
            // 清除timestamp比它大的
            const actions = projectHistory.filter((item: any) => item.timestamp > prev.timestamp).map(({ id }) => id);
            if (actions.length) {
                await historyStorage.delete(actions);
            }
        }
    }

    await historyStorage.put(historyData);
    await setProjectState(projectId, { historyAt: historyId });

    return historyId;
}

// 获取项目的历史记录
export async function getProjectHistory(projectId: string) {
    if (!projectId) {
        return [];
    }

    const projectHistory = await historyStorage.query('projectId', projectId);
    return projectHistory.sort((a: any, b: any) => a.timestamp - b.timestamp);
}

// 清除项目的历史记录
export async function clearProjectHistory(projectId: string) {
    if (!projectId) {
        return;
    }

    const projectHistory: any[] = await getProjectHistory(projectId);
    if (projectHistory.length) {
        const actions = projectHistory.map(({ id }) => id);
        await historyStorage.delete(actions);
    }
}

export async function getProjectState(projectId: string): Promise<{
    rails: WebCutRail[],
    sources: Record<string, WebCutSourceMeta>,
    historyAt?: string,
}> {
    if (!projectId) {
        return {
            rails: [],
            sources: {},
        };
    }
    const projectState = await projectStateStorage.getItem(projectId);
    return projectState;
}

export async function setProjectState(projectId: string, state: {
    rails?: WebCutRail[],
    sources?: Record<string, WebCutSourceMeta>,
    historyAt?: string,
}) {
    if (!projectId) {
        return;
    }
    const { rails, sources, historyAt } = state;
    if (!rails && !sources && !historyAt) {
        return;
    }

    const prevState = await getProjectState(projectId) || {};
    if (rails) {
        prevState.rails = rails;
    }
    if (sources) {
        prevState.sources = sources;
    }
    if (historyAt) {
        prevState.historyAt = historyAt;
    }

    await projectStateStorage.setItem(projectId, prevState);
}
// @ts-ignore
import InDB from 'indb'; // https://github.com/tangshuang/indb
import { write, file } from 'opfs-tools'; // https://github.com/hughfenghen/opfs-tools
import { createRandomString } from 'ts-fns';
import { getFileMd5 } from '../libs/file';
import { AsyncQueue } from '../libs/async-queue';
import {
    WebCutProjectHistoryData,
    WebCutProjectHistoryPushPayload,
    WebCutProjectHistoryPatch,
    WebCutProjectHistoryState,
    WebCutProjectState,
    WebCutProjectData,
    WebCutMaterial,
} from '../types';
import { createEmptyPatch } from '../libs/history-patch';

const queue = new AsyncQueue();

// 初始化 InDB 实例
const idb = new InDB({
    name: 'webcut',
    version: 8,
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
            name: 'project_history',
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
            // v8: 历史快照独立分表，历史列表行保持轻量（不再内联全量快照）
            name: 'project_history_snapshot',
            isKv: true,
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
const historyStorage = idb.use('project_history');

// 历史快照存储（key 为历史记录 id）
const historySnapshotStorage = idb.use('project_history_snapshot');

const projectStateStorage = idb.use('project_state');

const LEGACY_OPFS_FILE_PREFIX = '/webcut/file/';
const CURRENT_OPFS_FILE_PREFIX = '/file/';
const OPFS_MIGRATION_REPORT_KEY = 'WEBCUT_OPFS_MIGRATION_REPORT_V1';
let opfsMigrationPromise: Promise<void> | null = null;

const getLocalStorageSafe = (key: string) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const setLocalStorageSafe = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {}
};

async function migrateSingleLegacyFile(fileId: string): Promise<'migrated' | 'skipped' | 'failed'> {
    if (!fileId) {
        return 'skipped';
    }

    const currentPath = `${CURRENT_OPFS_FILE_PREFIX}${fileId}`;
    const legacyPath = `${LEGACY_OPFS_FILE_PREFIX}${fileId}`;
    const currentCtx = file(currentPath);
    if (await currentCtx.exists()) {
        return 'skipped';
    }

    const legacyCtx = file(legacyPath);
    if (!await legacyCtx.exists()) {
        return 'skipped';
    }

    try {
        // @ts-ignore
        await queue.push(async () => write(currentPath, await legacyCtx.stream(), { overwrite: true }));
        if (await currentCtx.exists()) {
            await legacyCtx.remove();
            return 'migrated';
        }
        return 'failed';
    } catch {
        return 'failed';
    }
}

async function runOpfsPathMigration() {
    const candidateIds = new Set<string>();

    // 1) 从外层文件系统元数据中收集 fileId
    try {
        const localMetaRaw = getLocalStorageSafe('LOCAL_FILE_META');
        const localMeta = localMetaRaw ? JSON.parse(localMetaRaw) : {};
        for (const fileId of Object.keys(localMeta || {})) {
            if (fileId) {
                candidateIds.add(fileId);
            }
        }
    } catch {}

    // 2) 从 webcut 的 file 表收集 fileId
    try {
        const files = await filesStorage.all();
        for (const item of files || []) {
            if (item?.id) {
                candidateIds.add(String(item.id));
            }
        }
    } catch {}

    let migrated = 0;
    let failed = 0;
    let skipped = 0;

    for (const fileId of candidateIds) {
        const ret = await migrateSingleLegacyFile(fileId);
        if (ret === 'migrated') migrated += 1;
        else if (ret === 'failed') failed += 1;
        else skipped += 1;
    }

    setLocalStorageSafe(OPFS_MIGRATION_REPORT_KEY, JSON.stringify({
        at: Date.now(),
        candidateCount: candidateIds.size,
        migrated,
        failed,
        skipped,
    }));
}

export function ensureWebCutOpfsPathMigration() {
    if (typeof window === 'undefined') {
        return Promise.resolve();
    }
    if (!opfsMigrationPromise) {
        opfsMigrationPromise = runOpfsPathMigration().catch((error) => {
            console.warn('[webcut] OPFS path migration failed:', error);
        });
    }
    return opfsMigrationPromise;
}

export async function getProject(projectId: string): Promise<WebCutProjectData | null> {
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

export async function createNewProject(id?: string): Promise<string> {
    const projectId = id || createRandomString(16);
    const projectData: WebCutProjectData = {
        id: projectId,
        name: `新项目 ${projectId}`,
        files: [],
    };
    await projectsStorage.put(projectData);
    return projectId;
}

export async function addFileToProject(projectId: string, fileId: string): Promise<WebCutProjectData | null> {
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

    projectData.files = (projectData.files || []).filter((item: any, index: number, arr: any[]) => {
        if (!item?.id) {
            return false;
        }
        return arr.findIndex((entry: any) => entry?.id === item.id) === index;
    });

    if (projectData.files.some((item: any) => item.id === fileId)) {
        return projectData;
    }

    projectData.files.push({
        id: fileId,
        time: Date.now(),
    });

    await projectsStorage.put(projectData);
    return projectData;
}

export async function removeFileFromProject(projectId: string, fileId: string): Promise<WebCutProjectData | null> {
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

export async function removeFileEverywhere(fileId: string) {
    if (!fileId) {
        return;
    }

    // 1) 从所有项目里移除该素材引用
    const projects = await projectsStorage.all();
    const actions: Promise<any>[] = [];
    for (const projectData of projects || []) {
        if (!projectData) {
            continue;
        }
        // 兼容旧版本
        if (!projectData.files && projectData.fileIds) {
            projectData.files = projectData.fileIds.map((id: string) => ({ id, time: Date.now() }));
            delete projectData.fileIds;
        }
        const prevLen = (projectData.files || []).length;
        projectData.files = (projectData.files || []).filter((item: any) => item?.id !== fileId);
        if (projectData.files.length !== prevLen) {
            actions.push(projectsStorage.put(projectData));
        }
    }
    if (actions.length) {
        await Promise.all(actions);
    }

    // 2) 删除素材元数据
    await filesStorage.delete([fileId]);

    // 3) 删除 OPFS 文件
    const opfsFilePath = `/file/${fileId}`;
    const fileCtx = file(opfsFilePath);
    if (await fileCtx.exists()) {
        await fileCtx.remove();
    }
}

export async function writeFile(f: File): Promise<string> {
    const fileId = await getFileMd5(f);
    const opfsFilePath = `/file/${fileId}`;


    if (await file(opfsFilePath).exists()) {
        return fileId;
    }

    await queue.push(() => write(opfsFilePath, f.stream(), { overwrite: true }));

    // // 用一个文件来保存扩展信息
    // const ext = f.name.includes('.') ? f.name.split('.').pop() : '';
    // const type = f.type;
    // const size = f.size;
    // const name = f.name;
    // const time = Date.now();
    // const opfsFileMetaPath = `/webcut/file_meta/${fileId}`;
    // await queue.push(() => write(opfsFileMetaPath, JSON.stringify({ ext, type, size, time, name }), { overwrite: true }));

    return fileId;
}

export async function readFile(fileId: string): Promise<File | null> {
    const opfsFilePath = `/file/${fileId}`;
    const fileCtx = file(opfsFilePath);
    if (!await fileCtx.exists()) {
        // 兜底迁移：若新路径缺失但旧路径存在，读取前即时迁移
        await migrateSingleLegacyFile(fileId);
    }
    if (await fileCtx.exists()) {
        // 兼容 opfs-tools 新旧版本：
        // - 旧版本存在 getOriginFile()
        // - 新版本仅提供 arrayBuffer()/stream()
        const legacyGetOriginFile = (fileCtx as any).getOriginFile;
        let outFile: File | null = null;

        if (typeof legacyGetOriginFile === 'function') {
            outFile = await legacyGetOriginFile.call(fileCtx);
        }

        let fileData: WebCutMaterial | null = null;
        try {
            fileData = await filesStorage.get(fileId);
        } catch {}

        if (!outFile) {
            const arrbuf = await fileCtx.arrayBuffer();
            const fallbackName = fileData?.name || `${fileId}.bin`;
            const fallbackType = fileData?.type || 'application/octet-stream';
            const fallbackTime = fileData?.time || Date.now();
            outFile = new File([arrbuf], fallbackName, {
                type: fallbackType,
                lastModified: fallbackTime,
            });
        }

        if (fileData) {
            const { name, type, time } = fileData;
            return new File([outFile], name, { type, lastModified: time });
        }

        return outFile;
    }
    return null;
}

export async function addFile(file: File, tags?: string[]) {
    const fileId = await writeFile(file);
    const fileData: WebCutMaterial = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        time: Date.now(),
        tags: tags || [],
    };
    await filesStorage.put(fileData);
    return fileId;
}

export async function addFileTags(fileId: string, tags: string[]) {
    const fileData = await getFile(fileId);
    if (!fileData) {
        throw new Error('文件不存在');
    }
    fileData.tags = [...new Set([...fileData.tags || [], ...tags])];
    await filesStorage.put(fileData);
}

export async function getFile(fileId: string): Promise<WebCutMaterial> {
    const fileData = await filesStorage.get(fileId);
    if (!fileData) {
        throw new Error('文件不存在');
    }
    return fileData;
}

export async function getAllFiles(): Promise<WebCutMaterial[]> {
    const files = await filesStorage.all();
    return files.reverse();
}

/**
 * 更新项目状态
 * @param projectId 项目ID
 * @param state 项目状态
 */
export async function updateProjectState(projectId: string, state: Partial<WebCutProjectState>) {
    if (!projectId || !state) {
        return;
    }

    let neeedToUpdate = false;
    const data: any = {};
    if ('historyAt' in state) {
        data.historyAt = state.historyAt;
        neeedToUpdate = true;
    }
    if ('aspectRatio' in state) {
        data.aspectRatio = state.aspectRatio;
        neeedToUpdate = true;
    }

    if (neeedToUpdate) {
        const prevState = await getProjectState(projectId) || {};
        await projectStateStorage.setItem(projectId, {
            ...prevState,
            ...data,
        });
    }
}

async function updateProjectHistoryCurrent(projectId: string, historyId: string | null) {
    const projectHistory = await getProjectHistory(projectId);
    if (!projectHistory.length) {
        return;
    }

    const actions: Promise<any>[] = [];
    for (const item of projectHistory) {
        const nextCurrent = !!historyId && item.id === historyId;
        if (!!item.current === nextCurrent) {
            continue;
        }
        actions.push(historyStorage.put({
            ...item,
            current: nextCurrent,
        }));
    }

    if (actions.length) {
        await Promise.all(actions);
    }
}

/**
 * 移动项目的历史记录指针
 * @param projectId 项目ID
 * @param to 移动方向，-1 表示上一个历史记录，即Undo，1 表示下一个历史记录，即Redo
 * @returns 移动后的历史记录数据
 */
export async function moveProjectHistoryTo(projectId: string, to: -1 | 1) {
    if (!projectId || !to) {
        return null;
    }

    const projectState = await getProjectState(projectId);
    const projectHistory = await getProjectHistory(projectId);
    const historyAt = projectState.historyAt || '';

    let index = projectHistory.length - 1;
    if (historyAt) {
        index = projectHistory.findIndex((item: any) => item.id === historyAt);
    }

    // 这里之所以要+1，是因为我们真实操作的对象，是其下一个历史记录
    // 比如当前index是4，to是1，其实代表的是我们要把索引值为6的历史记录进行还原
    // 同样的道理，to是-1，代表的是我们要把索引值为4（而非3）的历史记录进行还原
    const next = index + to;
    const targetHistory = projectHistory[next];
    if (!targetHistory) {
        return null;
    }

    const { id } = targetHistory;
    await updateProjectState(projectId, { historyAt: id });
    await updateProjectHistoryCurrent(projectId, id);

    return targetHistory;
}

/**
 * 将项目历史指针移动到指定历史记录
 */
export async function moveProjectHistoryToId(projectId: string, historyId: string) {
    if (!projectId || !historyId) {
        return null;
    }

    const projectHistory = await getProjectHistory(projectId);
    const targetHistory = projectHistory.find(item => item.id === historyId) || null;
    if (!targetHistory) {
        return null;
    }

    await updateProjectState(projectId, { historyAt: historyId });
    await updateProjectHistoryCurrent(projectId, historyId);
    return targetHistory;
}

/**
 * 将当前项目的状态保存为一个历史记录（兼容旧 API，内部走统一的轻行+快照分表存储）
 * @param projectId
 * @returns 历史记录ID
 */
export async function pushProjectHistory(projectId: string, historyState: WebCutProjectHistoryState) {
    if (!projectId) {
        return null;
    }
    return await pushProjectHistoryEntry(projectId, {
        title: '编辑变更',
        snapshot: historyState,
    });
}

/**
 * 使用完整历史结构写入一条历史记录
 * v8 起：列表行只存轻量数据（id/title/patch/指针等），全量快照独立存入 project_history_snapshot
 * @param projectId 项目ID
 * @param payload 完整历史数据（含 patch/title/snapshot）
 * @returns 历史记录ID
 */
export async function pushProjectHistoryEntry(projectId: string, payload: WebCutProjectHistoryPushPayload) {
    if (!projectId) {
        return null;
    }

    const projectState = await getProjectState(projectId);
    if (projectState?.historyAt) {
        const { historyAt } = projectState;
        const projectHistory: any[] = await getProjectHistory(projectId);
        const closest = projectHistory.find((item: any) => item.id === historyAt);
        if (closest) {
            const sortedHistory = projectHistory.sort((a: any, b: any) => a.timestamp - b.timestamp);
            const deleteAfterItems = sortedHistory
                .filter((item: any) => item.timestamp > closest.timestamp)
                .map(({ id }) => id);
            if (deleteAfterItems.length) {
                await deleteProjectHistoryEntries(deleteAfterItems);
            }
            const beforeItems = sortedHistory.filter((item: any) => item.timestamp <= closest.timestamp);
            if (beforeItems.length > 50) {
                const deleteBeforeItems = beforeItems.slice(0, beforeItems.length - 50).map(({ id }) => id);
                await deleteProjectHistoryEntries(deleteBeforeItems);
            }
        }
    }

    const state = payload.snapshot || payload.state;
    const patch: WebCutProjectHistoryPatch = payload.patch || createEmptyPatch();
    const undoPatch: WebCutProjectHistoryPatch = payload.undoPatch || createEmptyPatch();

    const historyId = createRandomString(16);
    const historyData: WebCutProjectHistoryData = {
        id: historyId,
        projectId,
        timestamp: Date.now(),
        current: true,
        title: payload.title || '编辑变更',
        patch,
        undoPatch,
        mergeKey: payload.mergeKey,
    };

    // 快照单独落表，历史列表读取不再反序列化全量状态
    if (state) {
        await historySnapshotStorage.setItem(historyId, state);
    }
    await historyStorage.put(historyData);
    await updateProjectState(projectId, { historyAt: historyId });
    await updateProjectHistoryCurrent(projectId, historyId);
    return historyId;
}

/**
 * 原地更新一条历史记录（用于手势合并：同 mergeKey 的连续调整合并为一条历史）
 */
export async function updateProjectHistoryEntry(projectId: string, historyId: string, payload: Partial<WebCutProjectHistoryPushPayload>) {
    if (!projectId || !historyId) {
        return null;
    }
    const historyData: any = await historyStorage.get(historyId);
    if (!historyData) {
        return null;
    }

    if (payload.title !== undefined) {
        historyData.title = payload.title;
    }
    if (payload.timestamp !== undefined) {
        historyData.timestamp = payload.timestamp;
    }
    if (payload.patch !== undefined) {
        historyData.patch = payload.patch;
    }
    if (payload.undoPatch !== undefined) {
        historyData.undoPatch = payload.undoPatch;
    }
    if (payload.mergeKey !== undefined) {
        historyData.mergeKey = payload.mergeKey;
    }
    const state = payload.snapshot || payload.state;
    if (state) {
        delete historyData.snapshot;
        delete historyData.state;
        await historySnapshotStorage.setItem(historyId, state);
    }

    await historyStorage.put(historyData);
    return historyId;
}

/** 读取某条历史记录的全量快照（优先快照表，兼容旧版内联数据） */
export async function getProjectHistorySnapshot(historyId: string): Promise<WebCutProjectHistoryState | null> {
    if (!historyId) {
        return null;
    }
    const snapshot = await historySnapshotStorage.getItem(historyId);
    if (snapshot) {
        return snapshot;
    }
    // 兼容旧数据：快照内联在历史行中
    const historyData: any = await historyStorage.get(historyId);
    return historyData?.snapshot || historyData?.state || null;
}

/** 同时删除历史列表行与对应的快照 */
async function deleteProjectHistoryEntries(historyIds: string[]) {
    if (!historyIds.length) {
        return;
    }
    await historyStorage.delete(historyIds);
    await historySnapshotStorage.delete(historyIds);
}

// 获取项目的历史记录
export async function getProjectHistory(projectId: string): Promise<WebCutProjectHistoryData[]> {
    if (!projectId) {
        return [];
    }

    const projectHistory = await historyStorage.query('projectId', projectId);
    // 懒迁移：旧版本的历史行内联了全量快照，首次读到时拆分到快照表并重写轻行
    const legacyItems = projectHistory.filter((item: any) => item && (item.snapshot || item.state));
    if (legacyItems.length) {
        const actions = legacyItems.map(async (item: any) => {
            const state = item.snapshot || item.state;
            try {
                await historySnapshotStorage.setItem(item.id, state);
                delete item.snapshot;
                delete item.state;
                await historyStorage.put(item);
            } catch {}
        });
        await Promise.all(actions);
    }
    return projectHistory.sort((a: any, b: any) => a.timestamp - b.timestamp);
}

// 清除项目的历史记录
export async function clearProjectHistory(projectId: string) {
    if (!projectId) {
        return;
    }

    const projectHistory: any[] = await getProjectHistory(projectId);
    if (projectHistory.length) {
        await deleteProjectHistoryEntries(projectHistory.map(({ id }) => id));
    }
    await updateProjectState(projectId, {
        historyAt: '',
    });
}

export async function getProjectState(projectId: string): Promise<WebCutProjectState> {
    if (!projectId) {
        return {
            historyAt: '',
            aspectRatio: '4:3',
        };
    }
    const projectState = await projectStateStorage.getItem(projectId);
    return projectState;
}

/**
 * 列出全部项目（宿主项目列表页用）。
 * 返回轻量行（id/name/files 引用），排序由宿主按自身元数据决定。
 */
export async function listProjects(): Promise<WebCutProjectData[]> {
    const projects = await projectsStorage.all();
    return (projects || []).filter(Boolean) as WebCutProjectData[];
}

/** 重命名项目 */
export async function renameProject(projectId: string, name: string): Promise<WebCutProjectData | null> {
    if (!projectId || !name) {
        return null;
    }
    const projectData = await projectsStorage.get(projectId);
    if (!projectData) {
        return null;
    }
    projectData.name = name;
    await projectsStorage.put(projectData);
    return projectData;
}

/**
 * 删除项目（级联清理）：
 * 1) 该项目全部历史记录（列表行 + 快照）；2) project_state；3) project 行；
 * 4) 孤儿文件：该项目引用且不被其他任何项目引用的 file 元数据与 OPFS 文件。
 *    注意：fileId 为 md5 内容寻址，与 @fgu/file 本地缓存共享 OPFS 路径空间——
 *    删除后外部缓存读取会 miss 并回源重新下载（服务端文件仍在），行为安全。
 */
export async function deleteProject(projectId: string): Promise<{ filesRemoved: number } | null> {
    if (!projectId) {
        return null;
    }
    const projectData = await projectsStorage.get(projectId);
    if (!projectData) {
        return null;
    }

    // 1) 删除该项目全部历史（列表行 + 快照）
    const projectHistory = await historyStorage.query('projectId', projectId);
    if (projectHistory.length) {
        await deleteProjectHistoryEntries(projectHistory.map(({ id }) => id));
    }

    // 2) 删除 project_state
    await projectStateStorage.delete([projectId]);

    // 3) 删除 project 行
    await projectsStorage.delete([projectId]);

    // 4) 孤儿文件清理：先收集剩余项目仍引用的 fileId
    const removedFileIds = ((projectData.files || []) as any[])
        .map((item) => item?.id)
        .filter((id): id is string => typeof id === 'string' && !!id);
    if (!removedFileIds.length) {
        return { filesRemoved: 0 };
    }
    const otherProjects = (await projectsStorage.all() || []).filter(Boolean);
    const stillUsedFileIds = new Set<string>();
    for (const other of otherProjects as any[]) {
        // 兼容旧版本（fileIds → files）
        const files = other.files || (other.fileIds || []).map((id: string) => ({ id }));
        for (const item of files || []) {
            if (item?.id) {
                stillUsedFileIds.add(String(item.id));
            }
        }
    }
    const orphanFileIds = removedFileIds.filter((id) => !stillUsedFileIds.has(id));
    for (const fileId of orphanFileIds) {
        await removeFileEverywhere(fileId);
    }
    return { filesRemoved: orphanFileIds.length };
}

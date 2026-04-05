import { clone, isEqual } from 'ts-fns';
import {
    WebCutProjectHistoryPatch,
    WebCutProjectHistoryPatchOperation,
    WebCutProjectHistoryState,
    WebCutSourceData,
} from '../types';

function createEmptyPatch(): WebCutProjectHistoryPatch {
    return {
        operations: [],
    };
}

function createSetRailsOperation(rails: WebCutProjectHistoryState['rails']): WebCutProjectHistoryPatchOperation {
    return {
        type: 'setRails',
        rails: clone(rails),
    };
}

function createUpsertSourceOperation(sourceKey: string, source: WebCutSourceData): WebCutProjectHistoryPatchOperation {
    return {
        type: 'upsertSource',
        sourceKey,
        source: clone(source),
    };
}

function createRemoveSourceOperation(sourceKey: string): WebCutProjectHistoryPatchOperation {
    return {
        type: 'removeSource',
        sourceKey,
    };
}

/**
 * 生成 history patch（redo 与 undo）
 * - redoPatch: before -> after
 * - undoPatch: after -> before
 */
export function createHistoryPatches(
    beforeState: WebCutProjectHistoryState | null | undefined,
    afterState: WebCutProjectHistoryState,
) {
    if (!beforeState) {
        const redoPatch: WebCutProjectHistoryPatch = {
            operations: [
                createSetRailsOperation(afterState.rails),
                ...Object.entries(afterState.sources).map(([sourceKey, source]) => createUpsertSourceOperation(sourceKey, source)),
            ],
        };

        const undoPatch: WebCutProjectHistoryPatch = {
            operations: [
                createSetRailsOperation([]),
                ...Object.keys(afterState.sources).map(sourceKey => createRemoveSourceOperation(sourceKey)),
            ],
        };

        return {
            patch: redoPatch,
            undoPatch,
        };
    }

    const redoOperations: WebCutProjectHistoryPatchOperation[] = [];
    const undoOperations: WebCutProjectHistoryPatchOperation[] = [];

    if (!isEqual(beforeState.rails, afterState.rails)) {
        redoOperations.push(createSetRailsOperation(afterState.rails));
        undoOperations.push(createSetRailsOperation(beforeState.rails));
    }

    const beforeSources = beforeState.sources;
    const afterSources = afterState.sources;

    const allKeys = new Set<string>([
        ...Object.keys(beforeSources),
        ...Object.keys(afterSources),
    ]);

    for (const sourceKey of allKeys) {
        const beforeSource = beforeSources[sourceKey];
        const afterSource = afterSources[sourceKey];

        if (!beforeSource && afterSource) {
            redoOperations.push(createUpsertSourceOperation(sourceKey, afterSource));
            undoOperations.push(createRemoveSourceOperation(sourceKey));
            continue;
        }

        if (beforeSource && !afterSource) {
            redoOperations.push(createRemoveSourceOperation(sourceKey));
            undoOperations.push(createUpsertSourceOperation(sourceKey, beforeSource));
            continue;
        }

        if (beforeSource && afterSource && !isEqual(beforeSource, afterSource)) {
            redoOperations.push(createUpsertSourceOperation(sourceKey, afterSource));
            undoOperations.push(createUpsertSourceOperation(sourceKey, beforeSource));
        }
    }

    return {
        patch: {
            operations: redoOperations,
        },
        undoPatch: {
            operations: undoOperations.reverse(),
        },
    };
}

/** 使用 patch 对项目状态做纯函数变换 */
export function applyHistoryPatch(
    baseState: WebCutProjectHistoryState,
    patch: WebCutProjectHistoryPatch,
): WebCutProjectHistoryState {
    if (!patch.operations.length) {
        return clone(baseState);
    }

    const nextState: WebCutProjectHistoryState = {
        rails: clone(baseState.rails),
        sources: clone(baseState.sources),
    };

    for (const operation of patch.operations) {
        if (operation.type === 'setRails') {
            nextState.rails = clone(operation.rails);
            continue;
        }

        if (operation.type === 'upsertSource') {
            nextState.sources[operation.sourceKey] = clone(operation.source);
            continue;
        }

        if (operation.type === 'removeSource') {
            delete nextState.sources[operation.sourceKey];
        }
    }

    return nextState;
}

export { createEmptyPatch };

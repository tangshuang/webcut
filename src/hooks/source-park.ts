import type { WebCutSource } from '../types';

/**
 * source 驻留池：将 source 从运行时摘除但不销毁（clip/sprite 保活），
 * undo/redo 往返或删除后撤销时可直接复活，避免反复创建/销毁解码器
 * 导致的内存压力与素材恢复失败。
 */

type ParkedSource = {
    source: WebCutSource;
    expireTimer?: ReturnType<typeof setTimeout>;
};

const PARK_TTL = 30_000;
const PARK_MAX = 6;

const pools = new Map<string, Map<string, ParkedSource>>();

function getPool(projectId: string): Map<string, ParkedSource> {
    let pool = pools.get(projectId);
    if (!pool) {
        pool = new Map();
        pools.set(projectId, pool);
    }
    return pool;
}

function destroyParked(parked: ParkedSource) {
    if (parked.expireTimer) {
        clearTimeout(parked.expireTimer);
    }
    try {
        // sprite.destroy 会连带销毁 clip
        parked.source.sprite.destroy();
    } catch {}
}

function evictOldest(pool: Map<string, ParkedSource>) {
    const oldestKey = pool.keys().next().value;
    if (oldestKey === undefined) {
        return;
    }
    const oldest = pool.get(oldestKey)!;
    pool.delete(oldestKey);
    destroyParked(oldest);
}

export type DetachSourceOptions = {
    canvas: { removeSprite: (sprite: any) => void } | null;
    sprites: { indexOf: (s: any) => number; splice: (i: number, n: number) => void };
    clips: { indexOf: (c: any) => number; splice: (i: number, n: number) => void };
    sourcesMap: { delete: (key: string) => void };
};

/**
 * 将 source 从运行时摘除并入驻留池（不销毁）。
 * 池满时按 FIFO 淘汰最旧的驻留对象并真正销毁。
 */
export function detachSourceToPark(projectId: string, source: WebCutSource | null | undefined, opts: DetachSourceOptions) {
    if (!source) {
        return;
    }
    const { canvas, sprites, clips, sourcesMap } = opts;
    canvas?.removeSprite(source.sprite);

    const sprIdx = sprites.indexOf(source.sprite);
    if (sprIdx !== -1) {
        sprites.splice(sprIdx, 1);
    }
    const clipIdx = clips.indexOf(source.clip);
    if (clipIdx !== -1) {
        clips.splice(clipIdx, 1);
    }
    sourcesMap.delete(source.key);

    const pool = getPool(projectId);
    while (pool.size >= PARK_MAX) {
        evictOldest(pool);
    }
    const parked: ParkedSource = { source };
    parked.expireTimer = setTimeout(() => {
        if (pool.get(source.key) === parked) {
            pool.delete(source.key);
            destroyParked(parked);
        }
    }, PARK_TTL);
    pool.set(source.key, parked);
}

/**
 * 尝试从驻留池复活 source。matcher 用于校验身份一致性（如类型/文件/入点未变），
 * 不匹配时销毁该驻留对象并返回 null。
 */
export function salvageSourceFromPark(projectId: string, key: string, matcher: (source: WebCutSource) => boolean): WebCutSource | null {
    const pool = getPool(projectId);
    const parked = pool.get(key);
    if (!parked) {
        return null;
    }
    pool.delete(key);
    if (!matcher(parked.source)) {
        destroyParked(parked);
        return null;
    }
    if (parked.expireTimer) {
        clearTimeout(parked.expireTimer);
    }
    return parked.source;
}

/** 清空并销毁某项目的全部驻留对象 */
export function disposeSourcePark(projectId: string) {
    const pool = getPool(projectId);
    for (const parked of pool.values()) {
        destroyParked(parked);
    }
    pool.clear();
}

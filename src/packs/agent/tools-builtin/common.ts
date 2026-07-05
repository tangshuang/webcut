/** 工具公共辅助。 */

/** 支持的画幅比例 */
export const ASPECT_RATIOS = ['21:9', '16:9', '4:3', '9:16', '3:4', '1:1'] as const;

/** 由画布宽高推断最接近的画幅比例 */
export function detectRatio(width: number, height: number): string {
    if (!width || !height) return '16:9';
    const target = width / height;
    let best = '16:9';
    let diff = Infinity;
    for (const key of ASPECT_RATIOS) {
        const [w, h] = key.split(':').map(Number);
        const d = Math.abs(w / h - target);
        if (d < diff) {
            diff = d;
            best = key;
        }
    }
    return best;
}

/** 由 mimetype 推断媒体大类（video/audio/image/text） */
export function mimeToKind(mime: string): 'video' | 'audio' | 'image' | 'text' {
    if (!mime) return 'text';
    const m = mime.toLowerCase();
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('audio/')) return 'audio';
    if (m.startsWith('image/')) return 'image';
    return 'text';
}

/** 把纳秒转秒（保留 3 位）用于展示 */
export function usToSec(us: number): number {
    return Math.round((us || 0) / 1000) / 1000;
}

/** 所有修改类工具 description 末尾追加的提示，配合「首轮注入+按需拉取」策略 */
export const REFRESH_HINT = '修改后建议调用 webcut.get_timeline_state 或 webcut.get_player_state 刷新上下文以确认结果。';

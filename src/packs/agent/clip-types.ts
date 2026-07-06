/** clips-bar 的 clip 列表项类型（独立于 .vue，便于多处 import）。 */
export interface ClipItem {
    key: string;
    index: number;      // @N 引用序号
    name: string;
    type: string;       // video/audio/image/text
    url?: string;       // 缩略图/预览 URL
    currentSelectedSegment?: boolean;  // 是否为时间轴当前高亮焦点
}

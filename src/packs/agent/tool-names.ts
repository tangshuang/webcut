/**
 * webcut.* 工具名 → i18n key 映射。
 *
 * 工具名（如 `webcut.add_text_segment`）与 i18n key 一一对应：
 *   webcut.<short>  →  webcut.agent.tool.<short>
 * 翻译文案维护在 ./i18n.ts 的 `webcut.agent.tool.*` 命名空间下。
 * 未提供翻译（语言缺失或工具未登记）时，UI 兜底显示短名 <short>。
 */

/** 取工具短名：`webcut.add_text_segment` → `add_text_segment` */
export function toolShortName(tool: string): string {
    return (tool || '').replace(/^webcut\./, '');
}

/** 取工具名的 i18n key：`webcut.add_text_segment` → `webcut.agent.tool.add_text_segment` */
export function toolNameI18nKey(tool: string): string {
    return 'webcut.agent.tool.' + toolShortName(tool);
}

/**
 * 已登记的 webcut 内置工具短名（用于校验 / 遍历，与 tools-builtin 保持一致）。
 * 新增工具时在此追加，并在 i18n.ts 提供对应翻译。
 */
export const BUILTIN_TOOL_SHORT_NAMES = [
    // timeline
    'add_text_segment',
    'add_media_from_library',
    'upload_source',
    'push_media',
    'push_series',
    'delete_segment',
    'split_segment',
    'update_text',
    'update_segment_props',
    'set_filters',
    'clear_timeline',
    // effects
    'apply_animation',
    'remove_animation',
    'apply_transition',
    'remove_transition',
    'separate_audio',
    'repair_pitch',
    // rail
    'set_rail_mute',
    'set_rail_hidden',
    'magnet_main_video',
    'set_aspect_ratio',
    // query
    'get_timeline_state',
    'get_player_state',
    'get_library',
    'get_selection',
    'list_effects',
    'list_history',
    // history
    'undo',
    'redo',
    'recover_to_history',
    // export
    'export_video',
    // view
    'seek_cursor',
    'set_scale',
    'play',
    'pause',
    'reset',
] as const;

import type { Component } from 'vue';
import type { WebCutExtensionPack } from '../../types';
import type { WebCutAgentAdapter } from './adapter';
import type { WebCutAgentTool, WebCutAgentToolRegistry } from './tools';
import { createToolRegistry } from './tools';
import { createBuiltinTools } from './tools-builtin/index';
import Sidebar from './components/sidebar.vue';
import { agentLanguagePackages } from './i18n';

/**
 * 内置 sparkle 图标，作为 dockConfig.triggerIcon 的可选 opt-in 值。
 * 默认不显示任何图标；想用 sparkle 时：`createWebCutAgentPack({ triggerIcon: AgentIcon })`。
 */
export { default as AgentIcon } from './components/agent-icon.vue';

/**
 * agent pack 实例：实现 WebCutExtensionPack，仅声明 dockConfig（dock 槽位），
 * 并额外携带 adapter 与工具注册表，供 sidebar 组件构造 runtime 与 agent 循环。
 */
export interface WebCutAgentPackInstance extends WebCutExtensionPack {
    dockConfig: {
        key: 'agent';
        sidebar: Component;
        triggerIcon?: Component;
        triggerText?: string;
        width?: number;
    };
    adapter: WebCutAgentAdapter;
    registry: WebCutAgentToolRegistry;
    /** 输入框底部操作槽位组件列表 */
    operationSlots: Component[];
    /** 是否启用附件上传 */
    supportsUploadAttachments: boolean;
    /** 自定义 @ mention 弹窗组件 */
    mentionSlot?: Component;
    /** 取当前作用域 id（adapter.chats 持久化 key + 调用方自用） */
    getScopeId?: () => string;
}

export interface CreateWebCutAgentPackOptions {
    /** LLM 网关 adapter（必传，由调用方实现） */
    adapter: WebCutAgentAdapter;
    /** 注入额外工具（不得与内置 webcut.* 同名） */
    tools?: WebCutAgentTool[];
    /** 边栏宽度，默认 420 */
    width?: number;
    /** 触发按钮顶部图标；不传则按钮不显示图标 */
    triggerIcon?: Component;
    /** 触发按钮文字（竖排旋转 90° 显示在 icon 下方） */
    triggerText?: string;
    /**
     * 输入框底部「操作槽位」组件列表。每个槽位按统一协议 emit `attach({type, data})`
     * 或 `update:attachment(payload)`；pack 收集所有槽位的结构化数据，随消息一并提交给 LLM（与选中素材平级）。
     * 例如 aiman 的 VideoParamsSlot（模型/分辨率/时长/比例）就是一个操作槽位。
     */
    operationSlots?: Component[];
    /** 是否启用附件上传（图片/视频/音频）。打开后输入框一行会出现上传按钮，adapter 需提供 uploadFile / previewFile。 */
    supportsUploadAttachments?: boolean;
    /**
     * 自定义 @ mention 弹窗组件。传入后替换 webcut 默认 dropdown。
     * 组件接收 { resources: MentionCandidate[], filter: string }，emit select(MentionSelectValue) / close。
     * MentionSelectValue = { id: string, name: string, type?: string, url?: string }
     */
    mentionSlot?: Component;
    /**
     * 取当前作用域 id（如 aiman 的 episodeId / projectId）。用于：
     * - adapter.chats 的 localStorage active chatId 按 scope 隔离持久化；
     * - 调用方在 adapter 内部自行使用（chats/SSE 端点）。
     * 后端驱动模式（adapter.chats 存在）建议传入。
     */
    getScopeId?: () => string;
}

/**
 * 创建一个 agent pack 类（实现 WebCutExtensionPack，仅声明 dockConfig）。
 * 用法：`createWebCutAgentPack({ adapter })`，把返回的类传给 `<WebCutEditor :packs="[...]">`。
 */
export function createWebCutAgentPack(options: CreateWebCutAgentPackOptions): new () => WebCutExtensionPack {
    const { adapter, tools, width, triggerIcon, triggerText, operationSlots, getScopeId, supportsUploadAttachments, mentionSlot } = options;
    const registry = createToolRegistry(createBuiltinTools(), tools);

    class WebCutAgentPack {
        dockConfig = {
            key: 'agent',
            sidebar: Sidebar,
            triggerIcon: triggerIcon,
            triggerText: triggerText || 'AI Assistant',
            width: width ?? 420,
        };
        languagePackages = agentLanguagePackages;
        adapter = adapter;
        registry = registry;
        operationSlots = operationSlots || [];
        getScopeId = getScopeId;
        supportsUploadAttachments = !!supportsUploadAttachments;
        mentionSlot = mentionSlot;
    }

    return WebCutAgentPack as unknown as new () => WebCutExtensionPack;
}

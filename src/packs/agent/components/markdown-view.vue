<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

// GFM 开启；breaks 关闭——单换行不转 <br>，保持标准 markdown 段落语义（避免单换行被渲染成空行）
marked.use({ gfm: true, breaks: false });

const props = defineProps<{ content: string }>();

/** 轻量 XSS 清理：移除 script / on* 事件 / javascript: 链接。
 *  agent 回复相对可信，这里仅做基础防线；如需更强防护建议外部接入 DOMPurify。 */
function sanitize(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s"']+)/gi, '$1="#"')
        .trim();
}

const html = computed(() => {
    const raw = props.content || '';
    if (!raw.trim()) return '';
    try {
        return sanitize(marked.parse(raw, { async: false }) as string);
    } catch {
        return '';
    }
});
</script>

<template>
    <div class="webcut-agent-md" v-html="html"></div>
</template>

<style scoped>
.webcut-agent-md {
    font-size: 13px;
    line-height: 1.6;
    word-break: break-word;
}
.webcut-agent-md :deep(p) {
    margin: 0 0 6px;
}
.webcut-agent-md :deep(p:last-child) {
    margin-bottom: 0;
}
.webcut-agent-md :deep(p:first-child) {
    margin-top: 0;
}
.webcut-agent-md :deep(h1),
.webcut-agent-md :deep(h2),
.webcut-agent-md :deep(h3),
.webcut-agent-md :deep(h4),
.webcut-agent-md :deep(h5),
.webcut-agent-md :deep(h6) {
    margin: 10px 0 6px;
    font-weight: 700;
    line-height: 1.35;
}
.webcut-agent-md :deep(h1) { font-size: 1.4em; }
.webcut-agent-md :deep(h2) { font-size: 1.25em; }
.webcut-agent-md :deep(h3) { font-size: 1.1em; }
.webcut-agent-md :deep(h4),
.webcut-agent-md :deep(h5),
.webcut-agent-md :deep(h6) { font-size: 1em; }

.webcut-agent-md :deep(ul),
.webcut-agent-md :deep(ol) {
    margin: 4px 0 6px;
    padding-left: 20px;
}
.webcut-agent-md :deep(li) {
    margin: 0;
}
.webcut-agent-md :deep(li > p) {
    margin: 0;
    display: inline;
}

.webcut-agent-md :deep(a) {
    color: var(--webcut-dock-primary, #00b4a2);
    text-decoration: none;
}
.webcut-agent-md :deep(a:hover) {
    text-decoration: underline;
}

.webcut-agent-md :deep(strong) { font-weight: 700; }
.webcut-agent-md :deep(em) { font-style: italic; }

.webcut-agent-md :deep(code) {
    background-color: var(--webcut-grey-deep-color, #eee);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.webcut-agent-md :deep(pre) {
    margin: 6px 0;
    padding: 10px 12px;
    background-color: var(--webcut-grey-deep-color, #eee);
    border-radius: 6px;
    overflow: auto;
}
.webcut-agent-md :deep(pre code) {
    background: transparent;
    padding: 0;
    font-size: 12px;
}

.webcut-agent-md :deep(blockquote) {
    margin: 6px 0;
    padding: 2px 12px;
    border-left: 3px solid var(--webcut-line-color, #ddd);
    opacity: 0.85;
}

.webcut-agent-md :deep(table) {
    margin: 6px 0;
    border-collapse: collapse;
    font-size: 12px;
}
.webcut-agent-md :deep(th),
.webcut-agent-md :deep(td) {
    border: 1px solid var(--webcut-line-color, #ddd);
    padding: 4px 8px;
}
.webcut-agent-md :deep(hr) {
    border: none;
    border-top: 1px solid var(--webcut-line-color, #ddd);
    margin: 8px 0;
}
</style>

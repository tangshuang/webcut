<script setup lang="ts">
import { computed } from 'vue';
import { NDropdown, NButton, NIcon } from 'naive-ui';
import { Add } from '@vicons/carbon';
import { createRandomString } from 'ts-fns';
import { useT } from '../../i18n/hooks';
import { useWebCutContext } from '../../hooks';
import { useWebCutHistory } from '../../hooks/history';
import { WebCutRail } from '../../types';

const t = useT();
const { rails, modules } = useWebCutContext();
const { push: pushHistory } = useWebCutHistory();

const addRailTypeOptions = computed(() => {
    const base = [
        { key: 'video', label: t('视频') },
        { key: 'audio', label: t('音频') },
        { key: 'image', label: t('图片') },
        { key: 'text', label: t('文本') },
    ];
    const ext = [...modules.value.values()]
        .map(item => item.materialConfig)
        .filter(Boolean)
        .map((cfg: any) => ({
            key: cfg.thingType,
            label: t(cfg.displayName || cfg.name || cfg.thingType),
        }));

    const seen = new Set<string>();
    return [...base, ...ext].filter((item) => {
        if (!item?.key || seen.has(item.key)) {
            return false;
        }
        seen.add(item.key);
        return true;
    });
});

function sortRailsByRule(items: WebCutRail[]) {
    const audioRails = items.filter(item => item.type === 'audio');
    const textRails = items.filter(item => item.type === 'text');
    const otherRails = items.filter(item => item.type !== 'audio' && item.type !== 'text');

    let newRails = [...audioRails, ...otherRails, ...textRails];
    const modulesWithSortHook = [...modules.value.values()].filter(item => item.onSortRails);
    if (modulesWithSortHook.length) {
        newRails = modulesWithSortHook.reduce((prev, cur) => cur.onSortRails?.(prev) || prev, newRails);
    }
    return newRails;
}

async function handleAddRail(type: string) {
    if (!type) {
        return;
    }

    const rail: WebCutRail = {
        id: createRandomString(16),
        type,
        segments: [],
        transitions: [],
    } as WebCutRail;

    if (type === 'video' && !rails.value.some(item => item.type === 'video' && item.main)) {
        (rail as any).main = true;
    }

    rails.value = sortRailsByRule([...rails.value, rail]);
    await pushHistory({ title: '新增轨道' });
}
</script>

<template>
    <n-dropdown trigger="click" placement="bottom-start" size="small" :options="addRailTypeOptions" @select="handleAddRail">
        <n-button quaternary size="tiny" :focusable="false" class="webcut-add-rail-button" id="webcut-tools-add-rail-button">
            <template #icon>
                <n-icon :component="Add"></n-icon>
            </template>
        </n-button>
    </n-dropdown>
</template>

<style scoped>
.webcut-add-rail-button {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background-color: rgba(160, 160, 160, 0.2);
}
.webcut-add-rail-button:hover {
    background-color: rgba(160, 160, 160, 0.3);
}
</style>

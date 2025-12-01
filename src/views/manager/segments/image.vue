<script setup lang="ts">
import { WebCutSegment, WebCutRail } from '../../../types';
import { computed } from 'vue';
import { useWebCutContext } from '../../../hooks';
import { useWebCutLocalFile } from '../../../hooks/local-file';
import { useWebCutManager } from '../../../hooks/manager';
import ContextMenu from '../../../components/context-menu/index.vue';
import { useWebCutHistory } from '../../../hooks/history';

const props = defineProps<{
    segment: WebCutSegment;
    rail: WebCutRail;
    railIndex: number;
    segmentIndex: number;
    segments: WebCutSegment[]
}>();

const { fileUrl } = useWebCutLocalFile();
const { sources } = useWebCutContext();
const { deleteSegment } = useWebCutManager();
const { pushHistory } = useWebCutHistory();

const source = computed(() => {
    const key = props.segment.sourceKey;
    const source = sources.value.get(key);
    return source;
});

const contextmenus = computed(() => [
    {
        label: '删除',
        key: 'delete',
    },
]);

async function handleSelectContextMenu(key: string) {
    if (key === 'delete') {
        await pushHistory({
            action: 'materialDeleted',
            deletedFromRailId: props.rail.id,
            deletedSegmentId: props.segment.id,
            materialType: 'image',
            sourceKey: props.segment.sourceKey,
        });
        deleteSegment({ segment: props.segment, rail: props.rail });
    }
}
</script>

<template>
    <context-menu :options="contextmenus" auto-hide v-slot="{ showContextMenus }" @select="handleSelectContextMenu">
        <div class="webcut-image-segment" @contextmenu.capture.stop="showContextMenus" :style="{
            backgroundImage: `url(${source?.fileId ? fileUrl(source?.fileId) : source?.url})`
        }">
        </div>
    </context-menu>
</template>

<style scoped>
.webcut-image-segment {
    height: 100%;
    width: 100%;
    background-repeat: repeat-x;
    background-size: contain;
}
</style>
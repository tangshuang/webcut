<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import {
    NButton,
    NIcon,
    NDropdown,
} from 'naive-ui';
import { Add } from '@vicons/carbon';
import { useWebCutLibrary } from '../../../hooks/library';
import { useWebCutPlayer } from '../../../hooks';
import { useT } from '../../../i18n/hooks';
import { useWebCutHistory } from '../../../hooks/history';
import { WebCutMaterial, WebCutThingType, WebCutMaterialType } from 'src/types';

const fileList = defineModel<WebCutMaterial[]>('files', { default: [] });
const emit = defineEmits(['added', 'deleted', 'leaveItem', 'enterItem', 'clickItem']);
const props = defineProps<{
    thingType: WebCutThingType;
    materialType: WebCutMaterialType;
    disableContextMenu?: boolean;
}>();

const t = useT();

const { push } = useWebCutPlayer();
const { removeFile } = useWebCutLibrary();
const { push: pushHistory } = useWebCutHistory();

// 右键菜单相关状态
const showDropdown = ref(false);
const x = ref(0);
const y = ref(0);
const currentFile = ref<any>(null);

// 右键菜单选项
const options = computed(() => [
    {
        label: t('删除'),
        key: 'delete'
    }
]);

// 处理右键菜单点击
function handleContextMenu(e: MouseEvent, file: any) {
    e.preventDefault();
    if (props.disableContextMenu) {
        return;
    }

    showDropdown.value = false;
    currentFile.value = file;
    nextTick().then(() => {
        showDropdown.value = true;
        x.value = e.clientX;
        y.value = e.clientY;
    });
}

// 处理菜单项选择
function handleSelect(key: string | number) {
    showDropdown.value = false;
    if (key === 'delete' && currentFile.value) {
        removeFile(currentFile.value.id);
        emit('deleted', currentFile.value);
    }
}

// 点击外部关闭菜单
function onClickoutside() {
    showDropdown.value = false;
}

async function handleAdd(material: any) {
    try {
        const { id } = material;
        await push(props.materialType, `file:${id}`);
        await pushHistory();
        emit('added', material);
    }
    catch (e) {
        console.error(e);
    }
}
</script>

<template>
    <div class="webcut-material-list">
        <div
            v-for="file in fileList"
            :key="file.id"
            class="webcut-material-item"
            @contextmenu.stop="handleContextMenu($event, file)"
            @mouseleave="emit('leaveItem', file)"
            @mouseenter="emit('enterItem', file)"
            @click="emit('clickItem', file)"
        >
            <div class="webcut-material-preview">
                <slot name="preview" :file="file"></slot>
                <slot :file="file"></slot>
                <n-button class="webcut-add-button" size="tiny" type="primary" circle @click.stop="handleAdd(file)">
                    <template #icon>
                        <n-icon>
                            <Add />
                        </n-icon>
                    </template>
                </n-button>
            </div>
            <div class="webcut-material-title">
                {{ file.name }}
            </div>
        </div>
        <div v-if="fileList.length === 0" class="webcut-empty-materials">
            {{ t('暂无素材，请先导入素材') }}
        </div>
        <!-- 右键菜单组件 -->
        <n-dropdown placement="bottom-start" trigger="manual" :x="x" :y="y" :options="options" :show="showDropdown"
            :on-clickoutside="onClickoutside" size="small" @select="handleSelect" />
    </div>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>
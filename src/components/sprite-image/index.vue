<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

// 组件属性
const props = defineProps<{
    /**
     * 图标名称
     */
    name: string;
    /**
     * 图标尺寸
     */
    size?: number | {
        width: number,
        height: number,
    };
    config: {
        /**
         * 雪碧图路径
         * 通过这个可以获取到雪碧图的实际尺寸
         */
        src: string;
        /**
         * 图标名称列表
         */
        names: string[];
        /**
         * 原始图中的图标尺寸
         */
        eachSize: number | {
            width: number,
            height: number,
        };
        /**
         * 原始图中每一行的顶部位置
         * 这个数量代表着行数
         */
        topPositions: number[];
        /**
         * 原始图中每一行的左侧位置
         * 这个数量代表着列数
         */
        leftPositions: number[];
    };
}>();

const boxRef = ref();
const boxSize = ref({ width: 0, height: 0 });
const imageSize = ref({ width: 0, height: 0 });
const iconSize = computed(() => {
    if (props.size) {
        return {
            width: typeof props.size === 'number' ? props.size : props.size.width,
            height: typeof props.size === 'number' ? props.size : props.size.height,
        };
    }
    if (boxSize.value.width && boxSize.value.height) {
        return {
            width: boxSize.value.width,
            height: boxSize.value.height,
        };
    }
    return {
        width: typeof props.config.eachSize === 'number' ? props.config.eachSize : props.config.eachSize.width,
        height: typeof props.config.eachSize === 'number' ? props.config.eachSize : props.config.eachSize.height,
    };
});
// 缩放比例
const scale = computed(() => {
    const targetSize = iconSize.value.width;
    const originalSize = typeof props.config.eachSize === 'number' ? props.config.eachSize : props.config.eachSize.width;
    return targetSize / originalSize;
});
// 作为背景图时的尺寸
const bgImgSize = computed(() => {
    return {
        width: imageSize.value.width * scale.value,
        height: imageSize.value.height * scale.value
    };
});

// 计算图标索引
const iconIndex = computed(() => {
    const index = props.config.names.indexOf(props.name);
    return index >= 0 ? index : props.config.names.length - 1; // 默认使用最后一个图标
});

// 计算图标在雪碧图中的位置
const iconPosition = computed(() => {
    const row = Math.floor(iconIndex.value / props.config.leftPositions.length);
    const col = iconIndex.value % props.config.leftPositions.length;

    const top = -props.config.topPositions[row] * scale.value;
    const left = -props.config.leftPositions[col] * scale.value;

    return { x: left, y: top };
});

// 计算图标样式
const iconStyle = computed(() => {
    return {
        width: iconSize.value.width,
        height: iconSize.value.height,
        backgroundImage: `url(${props.config.src})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${iconPosition.value.x}px ${iconPosition.value.y}px`,
        backgroundSize: `${bgImgSize.value.width}px ${bgImgSize.value.height}px`
    };
});

watch(() => props.config.src, (src) => {
    if (src) {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            imageSize.value.width = img.width;
            imageSize.value.height = img.height;
        };
    }
}, { immediate: true });

onMounted(() => {
    if (boxRef.value) {
        boxSize.value.width = boxRef.value.offsetWidth;
        boxSize.value.height = boxRef.value.offsetHeight;
    }
});
</script>

<template>
    <div class="webcut-sprite-icon" :style="iconStyle" ref="boxRef">
        <slot></slot>
    </div>
</template>

<style scoped>
.webcut-sprite-icon {
    display: inline-block;
    vertical-align: middle;
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWebCutContext, useWebCutPlayer } from '../../../hooks';
import { buildTextAsDOM, measureTextSize } from '../../../libs';
import { clone } from 'ts-fns';

const { updateText } = useWebCutPlayer();
const { currentSource, editTextState, player, width, height } = useWebCutContext();
const editBoxRef = ref<HTMLDivElement | null>(null);
const editNodeRef = ref<HTMLElement | null>(null);
const coverLayerRef = ref<HTMLElement | null>(null);

// 监听编辑状态变化，自动聚焦和初始化内容
watch(editTextState, (state) => {
    if (state?.isActive) {
        mount();
    }
    else {
        unmount();
    }
}, { immediate: true });


// 监听editTextState变化，当文本内容发生变化时，触发更新
watch(() => ({ ...editTextState.value }), (newState, oldState) => {
    if (!isMathCurrentSource()) {
        return;
    }
    if (newState.sourceKey && newState?.sourceKey === oldState?.sourceKey && newState?.isActive && oldState?.isActive && typeof newState.text === 'string' && newState.text !== oldState.text) {
        // 文本内容发生了变化
        // 触发更新
        updateText(newState.sourceKey, { text: newState.text });
    }
});

const handleInput = () => {
    if (!isMathCurrentSource()) {
        return;
    }
    if (editBoxRef.value && editTextState.value) {
        const text = editNodeRef.value!.innerText;
        editTextState.value.text = text;
        // 同步更新双层文本结构中的底层文本
        if (coverLayerRef.value) {
            coverLayerRef.value.innerHTML = text;
        }

        // 更新盒子的尺寸
        const size = measureTextSize(text, currentSource.value?.meta?.text?.css || {});
        editBoxRef.value.style.width = `${size.width + 2}px`;
        editBoxRef.value.style.height = `${size.height}px`;
    }
};

const handleBlur = () => {
    unmount();
};


function isMathCurrentSource() {
    return currentSource.value && editTextState.value && currentSource.value.key === editTextState.value.sourceKey;
}

function mount() {
    if (!player.value) {
        return;
    }

    if (!currentSource.value) {
        return;
    }

    const { sprite, meta, text } = currentSource.value;
    if (!sprite) {
        return;
    }
    if (!meta?.text) {
        return;
    }

    const { viewport, canvasScale = 1 } = player.value;
    const { top, left } = viewport.getBoundingClientRect();

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
    container.style.width = `${width.value}px`;
    container.style.height = `${height.value}px`;
    container.style.zIndex = '9999';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';  // 添加半透明背景
    container.style.transform = `scale(${canvasScale})`;
    container.style.transformOrigin = 'top left';
    container.style.overflow = 'hidden';

    const editBox = document.createElement('div');
    const { x, y, w, h, angle } = sprite.rect;
    Object.assign(editBox.style, {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${w + 2}px`,
        height: `${h}px`,
        transform: `rotate(${angle}rad)`,
        transformOrigin: 'center',
        zIndex: 9999, // 确保编辑区域可见
        outline: 'none',
        cursor: 'text',
        userSelect: 'text',
        whiteSpace: 'pre',
    });

    const css: any = clone(meta.text.css || {});
    delete css.height;
    const node = buildTextAsDOM({ text: text || '', css });
    node.style.width = '100%';
    node.style.height = '100%';

    editBox.appendChild(node);
    container.appendChild(editBox);
    document.body.appendChild(container);
    editBoxRef.value = editBox as HTMLDivElement;

    // 获取双层文本结构的引用
    editNodeRef.value = node.querySelector('.stroke-layer') as HTMLElement;
    coverLayerRef.value = node.querySelector('.cover-layer') as HTMLElement;
    if (coverLayerRef.value) {
        coverLayerRef.value.style.pointerEvents = 'none';
    }
    editNodeRef.value.contentEditable = 'true';

    if (currentSource.value.sprite) {
        currentSource.value.sprite.visible = false;
    }

    editNodeRef.value.addEventListener('input', handleInput);
    editNodeRef.value.addEventListener('blur', handleBlur);
    editNodeRef.value.focus();
    const range = document.createRange();
    const selection = window.getSelection();
    if (editNodeRef.value.lastChild && selection) {
        range.setStartAfter(editNodeRef.value.lastChild);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

function unmount() {
    editTextState.value = null;
    if (editBoxRef.value) {
        editBoxRef.value.removeEventListener('input', handleInput);
        editBoxRef.value.removeEventListener('blur', handleBlur);
        document.body.removeChild(editBoxRef.value.parentElement!);
        editBoxRef.value = null;
    }
    editNodeRef.value = null;
    coverLayerRef.value = null;
    if (currentSource.value?.sprite) {
        currentSource.value.sprite.visible = true;
    }
}

onBeforeUnmount(unmount);

function onDoubleClickTextOnCanvas(e: MouseEvent) {
    if (!currentSource.value) {
        return;
    }
    if (currentSource.value.type !== 'text') {
        return;
    }

    const { sprite } = currentSource.value;
    if (!sprite) {
        return;
    }

    const { pageX, pageY } = e;
    const { viewport, canvasScale = 1 } = player.value;
    const { left, top } = viewport.getBoundingClientRect();
    const clickX = pageX - left;
    const clickY = pageY - top;

    const { rect } = sprite;
    const { x, y, w, h, angle } = rect;

    // 碰撞算法，检查clickX, clickY是否处于rect范围内
    const rectX = x * canvasScale;
    const rectY = y * canvasScale;
    const rectW = w * canvasScale;
    const rectH = h * canvasScale;
    // 要考虑旋转角度的问题，angle的单位是rad
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // 计算矩形中心点
    const centerX = rectX + rectW / 2;
    const centerY = rectY + rectH / 2;
    // 点击点是否在矩形内
    const isInRect = (x: number, y: number) => {
        // 将点击点平移，使矩形中心与原点重合
        const translatedX = x - centerX;
        const translatedY = y - centerY;
        // 对平移后的点进行反向旋转（与矩形旋转方向相反）
        const rotatedX = translatedX * cos + translatedY * sin;
        const rotatedY = translatedY * cos - translatedX * sin;
        // 检查旋转后的点是否在原始轴对齐的矩形内
        const halfW = rectW / 2;
        const halfH = rectH / 2;
        return (Math.abs(rotatedX) <= halfW && Math.abs(rotatedY) <= halfH);
    };

    if (!isInRect(clickX, clickY)) {
        return;
    }

    // 点击点在矩形内，触发编辑
    editTextState.value = {
        sourceKey: currentSource.value.key,
        text: currentSource.value.text!,
        isActive: true,
    };
}

onMounted(() => {
    player.value?.viewport?.addEventListener('dblclick', onDoubleClickTextOnCanvas);
});
onBeforeUnmount(() => {
    player.value?.viewport?.removeEventListener('dblclick', onDoubleClickTextOnCanvas);
});
</script>

<template></template>


<script setup lang="ts">
import SpriteImage from './index.vue';
import transitionSpriteImage from '../../img/transition-sprite.jpg';

defineProps<{
    name: string;
}>();

const config = {
    src: transitionSpriteImage,
    names: [
        'fade', '_',
        'zoom', 'blinds',
        'dissolve', 'slide',
        '_2',  'rotate',
        'change', 'blur',
    ],
    eachSize: {
        width: 192,
        height: 116,
    },
    topPositions: [0, 133, 266, 399, 532],
    leftPositions: [0, 208],
};
</script>

<template>
    <SpriteImage :name="name" :config="config" />
</template>

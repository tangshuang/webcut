<script setup lang="ts">
import { useWebCutLocalFile } from '../../../hooks/local-file';
import Container from '../_shared/container.vue';

const { fileUrl } = useWebCutLocalFile();
</script>

<template>
  <Container
    thingType="image"
    materialType="image"
    accept="image/*"
    supportsDirectoryUpload
  >
    <template #listItemContent="{ file }">
      <img :src="fileUrl(file.id)" class="webcut-material-image"></img>
    </template>
  </Container>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>
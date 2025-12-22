<script setup lang="ts">
import { useWebCutLocalFile } from '../../../hooks/local-file';
import Container from '../_shared/container.vue';

const { fileUrl } = useWebCutLocalFile();

function toggleVideo(file: any) {
    const audio = document.getElementById(file.id) as HTMLVideoElement;
    if (audio.paused) {
        audio.play();
    } else {
        audio.pause();
    }
}

function stopVideo(file: any) {
    const audio = document.getElementById(file.id) as HTMLVideoElement;
    audio.pause();
}
</script>

<template>
  <Container
    thingType="video"
    materialType="video"
    accept="video/*,.mkv"
    :enableMultipleSelect="true"
    @leaveListItem="stopVideo"
    @clickListItem="toggleVideo"
    supportsDirectoryUpload
  >
    <template #listItemContent="{ file }">
      <video :src="fileUrl(file.id)" class="webcut-material-video" :id="file.id"></video>
    </template>
  </Container>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>
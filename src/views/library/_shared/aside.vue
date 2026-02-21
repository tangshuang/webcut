<script setup lang="ts">
import { useT } from '../../../i18n/hooks';
import { useWebCutContext } from '../../../hooks';
import { computed, onMounted, markRaw, watch } from 'vue';
import { WebCutThingType } from '../../../types';

export type Nav = { label: string; key: string; component?: any };

const navKey = defineModel<string>('current', { default: '' });
const selectedNav = defineModel<Nav>('selected', { default: null });
const thingNavs = defineModel<Nav[]>('navs', {
  default: [
    {
      label: '当前',
      key: 'this',
    },
    {
      label: '导入',
      key: 'import',
    },
    {
      label: '所有',
      key: 'all',
    },
  ],
});
const props = defineProps<{
    thingType: WebCutThingType;
}>();

const t = useT();
const { modules } = useWebCutContext();

const extensions = computed(() => {
  const confs = [...modules.value.values()].filter(item => item.libraryConfig).map(module => module.libraryConfig);
  return confs;
});

watch(extensions, () => {
  if (!extensions.value.length) {
    return;
  }

  const realNavs = [...thingNavs.value];
  extensions.value.forEach((ext) => {
    const { navs } = ext!;
    if (!navs) {
      return;
    }
    navs.forEach((nav) => {
      const { targetThing, insertBeforeIndex, key, label, component } = nav;
      if (targetThing !== props.thingType) {
        return;
      }
      if (insertBeforeIndex !== undefined) {
        realNavs.splice(insertBeforeIndex, 0, {
          label,
          key,
          component,
        });
      } else {
        realNavs.push({
          label,
          key,
          component,
        });
      }
    });
  }, []);
  thingNavs.value = realNavs;
}, { immediate: true });

onMounted(() => {
  if (!navKey.value) {
    resetToFirstNav();
  }
});

function handleSelect(nav: Nav) {
    navKey.value = nav.key;
    selectedNav.value = markRaw(nav);
}

function resetToFirstNav() {
  handleSelect(thingNavs.value[0]);
}

defineExpose({
  resetToFirstNav,
});
</script>

<template>
    <aside class="webcut-library-panel-aside">
      <div v-for="nav in thingNavs" :key="nav.key" class="webcut-library-panel-aside-btn" :class="{ 'webcut-library-panel-aside-btn--active': navKey === nav.key }" @click="handleSelect(nav)">{{ t(nav.label) }}</div>
    </aside>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>

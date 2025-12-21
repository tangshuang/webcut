<script setup lang="ts">
import { useT } from '../../../i18n/hooks';
import { useWebCutContext } from '../../../hooks';
import { computed, onMounted } from 'vue';
import { WebCutThingType } from '../../../types';

const actionType = defineModel('current', { default: '' });
const selectedNav = defineModel('selected', { default: null });
const props = defineProps<{
    thingType: WebCutThingType;
    thingNavs?: { label: string; key: string; component?: any }[];
}>();

const t = useT();
const { modules } = useWebCutContext();

const defaultNavs: { label: string; key: string; component?: any }[] = props.thingNavs || [
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
];

const extensions = computed(() => {
  const confs = [...modules.value.values()].filter(item => item.libraryConfig).map(module => module.libraryConfig);
  return confs;
});

const finalNavs = computed(() => {
  const realNavs = [...defaultNavs];
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
  return realNavs;
});

onMounted(() => {
  if (!actionType.value) {
    actionType.value = finalNavs.value[0].key;
  }
});

function handleSelect(nav: any) {
    actionType.value = nav.key;
    selectedNav.value = nav;
}
</script>

<template>
    <aside class="webcut-library-panel-aside">
      <div v-for="nav in finalNavs" :key="nav.key" class="webcut-library-panel-aside-btn" :class="{ 'webcut-library-panel-aside-btn--active': actionType === nav.key }" @click="handleSelect(nav)">{{ t(nav.label) }}</div>
    </aside>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>

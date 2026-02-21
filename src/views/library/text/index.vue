<script setup lang="ts">
import { ref } from 'vue';
import {
  NButton,
  NIcon,
} from 'naive-ui';
import { Add } from '@vicons/carbon';
import { useWebCutPlayer } from '../../../hooks';
import { useT } from '../../../i18n/hooks';
import { useWebCutHistory } from '../../../hooks/history';
import Aside from '../_shared/aside.vue';
import ScrollBox from '../../../components/scroll-box/index.vue';

const { push } = useWebCutPlayer();
const { push: pushHistory } = useWebCutHistory();
const t = useT();

const actionType = ref<string>('create');
const selectedNav = ref<any>(null);

async function handleAdd() {
  await push('text', t('默认文本'));
  await pushHistory();
}
</script>

<template>
  <div class="webcut-library-panel">
    <Aside
      :current="actionType"
      :selected="selectedNav"
      :thingNavs="[{ label: '新建文本', key: 'create' }]"
      thingType="text"
    ></Aside>

    <!-- 右侧素材列表 -->
    <main class="webcut-library-panel-main">
      <div class="webcut-material-list" v-if="actionType === 'create'">
        <div class="webcut-material-item">
          <div class="webcut-material-preview">
            <div>{{ t('默认文本') }}</div>
            <n-button class="webcut-add-button" size="tiny" type="primary" circle @click="handleAdd">
              <template #icon>
                <n-icon>
                  <Add />
                </n-icon>
              </template>
            </n-button>
          </div>
        </div>
      </div>

      <scroll-box class="webcut-material-container" v-if="selectedNav?.component">
        <component
          :is="selectedNav.component"
          :onAdd="handleAdd"
        ></component>
      </scroll-box>
    </main>
  </div>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";
</style>
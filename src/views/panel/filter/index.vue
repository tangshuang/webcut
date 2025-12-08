<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useWebCutContext, useWebCutPlayer } from '../../../hooks';
import { NForm, NFormItem, NDivider, NSlider, NSelect } from 'naive-ui';
import { useT } from '../../../hooks/i18n';
import { useWebCutHistory } from '../../../hooks/history';

const { currentSource } = useWebCutContext();
const { syncSourceMeta } = useWebCutPlayer();
const { push: pushHistory } = useWebCutHistory();
const t = useT();

// 内置滤镜列表
const builtinFilters = ref<string[]>([
  'grayscale',
  'blur',
  'brightness',
  'contrast',
  'saturate'
]);

// 当前素材的滤镜列表，支持带参数的格式
const currentFilters = ref<Array<string | { name: string; params?: Record<string, any> }>>([]);

// 当前选中的滤镜，用于调节参数
const selectedFilter = ref<string | null>(null);

// 监听当前选中素材变化
watch(() => currentSource.value, () => {
  if (currentSource.value) {
    currentFilters.value = currentSource.value.meta.filters || [];
    // 默认选中第一个滤镜
    if (currentFilters.value.length > 0) {
      selectedFilter.value = typeof currentFilters.value[0] === 'string' ? currentFilters.value[0] : currentFilters.value[0].name;
    } else {
      selectedFilter.value = null;
    }
  } else {
    currentFilters.value = [];
    selectedFilter.value = null;
  }
}, { immediate: true, deep: true });

// 计算当前可用的滤镜选项
const availableFilters = computed(() => {
  return builtinFilters.value.map(filter => {
    // 检查滤镜是否已添加（支持字符串和对象格式）
    const isSelected = currentFilters.value.some(f =>
      typeof f === 'string' ? f === filter : f.name === filter
    );
    return {
      key: filter,
      name: filter,
      isSelected
    };
  });
});

// 获取当前选中滤镜的参数
const selectedFilterParams = computed(() => {
  if (!selectedFilter.value) return { amount: 100 };

  const filter = currentFilters.value.find(f =>
    typeof f === 'string' ? f === selectedFilter.value : f.name === selectedFilter.value
  );

  if (typeof filter === 'string') {
      return { amount: 100 };
    } else {
      return filter?.params || { amount: 100 };
    }
});

// 切换滤镜
async function toggleFilter(filterName: string) {
  let newFilters: Array<string | { name: string; params?: Record<string, any> }>;

  // 检查滤镜是否已添加
  const existingIndex = currentFilters.value.findIndex(f =>
    typeof f === 'string' ? f === filterName : f.name === filterName
  );

  if (existingIndex >= 0) {
    // 移除滤镜
    newFilters = currentFilters.value.filter((_, index) => index !== existingIndex);
    // 如果移除的是当前选中的滤镜，选择第一个可用的滤镜
    if (selectedFilter.value === filterName) {
      if (newFilters.length > 0) {
        selectedFilter.value = typeof newFilters[0] === 'string' ? newFilters[0] : newFilters[0].name;
      } else {
        selectedFilter.value = null;
      }
    }
  } else {
    // 添加滤镜，默认参数
    newFilters = [...currentFilters.value, { name: filterName, params: { amount: 100 } }];
    // 选中新添加的滤镜
    selectedFilter.value = filterName;
  }

  updateFilters(newFilters);
  await pushHistory();
}

// 更新滤镜参数
async function updateFilterParams(paramName: string, value: number) {
  if (!selectedFilter.value) return;

  const newFilters = [...currentFilters.value].map(f => {
    if (typeof f === 'string') {
      if (f === selectedFilter.value) {
        return { name: f, params: { [paramName]: value } };
      }
      return f;
    } else {
      if (f.name === selectedFilter.value) {
        return { ...f, params: { ...f.params, [paramName]: value } };
      }
      return f;
    }
  });

  updateFilters(newFilters);
  await pushHistory();
}

// 更新滤镜到素材meta
function updateFilters(filters: Array<string | { name: string; params?: Record<string, any> }>) {
  if (!currentSource.value) return;

  currentFilters.value = filters;
  syncSourceMeta(currentSource.value, {
    filters
  });
}
</script>

<template>
  <n-form size="small" label-placement="left" :label-width="60" class="webcut-panel-form webcut-filter-panel">
    <!-- 滤镜列表标题 -->
    <div class="webcut-filter-section-header">{{ t('可用滤镜') }}</div>

    <n-divider style="margin: 12px 0;" />

    <!-- 滤镜方块列表 -->
    <section class="webcut-filter-section">
      <div class="webcut-filter-list-section">
        <div
          v-for="filter in availableFilters"
          class="webcut-filter-item"
          :class="{
            'webcut-filter-item--selected': filter.isSelected
          }"
          :key="filter.key"
          @click="toggleFilter(filter.key)"
        >
          <div class="webcut-filter-item-thumb">
            <!-- 可以添加滤镜图标，这里暂时用文字 -->
            <span class="filter-thumb-text">{{ filter.name.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="webcut-filter-item-name">{{ filter.name }}</div>
        </div>
      </div>
    </section>

    <!-- 滤镜参数调节 -->
    <div v-if="currentFilters.length > 0" class="webcut-filter-params-section">
      <div class="webcut-filter-section-header">{{ t('滤镜参数') }}</div>
      <n-divider style="margin: 12px 0;" />

      <!-- 滤镜选择下拉框 -->
      <n-form-item :label="t('选择滤镜')">
        <n-select
          v-model:value="selectedFilter"
          :options="currentFilters.map(f => ({
            label: typeof f === 'string' ? f : f.name,
            value: typeof f === 'string' ? f : f.name
          }))"
          placeholder="{{ t('请选择要编辑的滤镜') }}"
          style="width: 100%"
        />
      </n-form-item>

      <!-- 强度调节滑块 -->
      <n-form-item v-if="selectedFilter" :label="t('强度')">
        <n-slider
          v-model:value="selectedFilterParams.amount"
          :min="0"
          :max="200"
          :step="1"
          @update:value="updateFilterParams('amount', $event)"
        />
        <span class="webcut-filter-form-value" style="margin-left: 4px;">{{ selectedFilterParams.amount }}%</span>
      </n-form-item>
    </div>
  </n-form>
</template>

<style scoped>
.webcut-filter-panel {
  display: flex;
  flex-direction: column;
  height: calc(var(--scroll-box-height, 100%) - 16px);
}

.webcut-filter-section-header {
  font-weight: 500;
}

.webcut-filter-section {
  display: contents;
}

.webcut-filter-list-section {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  flex-basis: 0;
  gap: 12px;
  height: calc(100% - 12px);
  overflow: hidden;
}

.webcut-filter-list-section::after {
  content: '';
  flex: 0 0 auto;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.webcut-filter-item {
  position: relative;
  width: 42px;
  cursor: default;
}

.webcut-filter-item-thumb {
  width: 42px;
  height: 42px;
  box-sizing: border-box;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--text-color-3);
  background-color: var(--background-color);
  transition: all 0.2s ease;
}

.webcut-filter-item--selected .webcut-filter-item-thumb {
  border-color: var(--primary-color);
  background-color: var(--primary-color-light);
  color: var(--primary-color);
}

.filter-thumb-text {
  font-weight: 500;
}

.webcut-filter-item-name {
  text-align: center;
  margin-top: 4px;
  font-size: var(--webcut-font-size-tiny);
  max-width: 100%;
  white-space: wrap;
  line-height: 1;
  color: var(--text-color);
}

.no-filters {
  color: #999;
  font-style: italic;
}

.webcut-filter-panel :deep(.n-form > .n-form-item:last-of-type .n-form-item-feedback-wrapper:not(:has(*))) {
  display: none;
}

.webcut-filter-params-section {
  margin-top: 12px;
}

.webcut-filter-empty {
  margin-top: 12px;
}

.webcut-filter-empty-text {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 20px 0;
}

.webcut-filter-panel :deep(.n-slider) {
  margin: 8px 0;
}

.webcut-filter-panel :deep(.n-slider__suffix) {
  color: var(--text-color-3);
  font-size: var(--webcut-font-size-tiny);
}
</style>

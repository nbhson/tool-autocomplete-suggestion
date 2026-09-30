<template>
  <div ref="host" style="width: 100%"></div>
</template>

<script setup lang="ts" generic="T">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { createAutocomplete } from 'sautocomplete-suggestion';
import type {
  AutocompleteInstance,
  DesignTokens,
  GroupConfig,
  HistoryAdapter,
  LocaleStrings,
  SuggestionItem,
} from 'sautocomplete-suggestion';
import 'sautocomplete-suggestion/dist/styles.css';

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    value?: string;
    items?: Array<SuggestionItem<T>>;
    groups?: GroupConfig[];
    groupOrder?: string[];
    dropup?: boolean;
    disabled?: boolean;
    minChars?: number;
    maxHistory?: number;
    history?: string[];
    historyAdapter?: HistoryAdapter;
    maxItemsPerGroup?: number;
    maxTotalItems?: number;
    virtualizeThreshold?: number;
    showStatusBar?: boolean;
    showHistory?: boolean;
    showApplyButton?: boolean;
    className?: string;
    locale?: LocaleStrings;
    submitIcon?: string;
    color?: string;
    colorDark?: string;
    borderRadius?: string | number;
    tokens?: DesignTokens;
    name?: string;
    debug?: boolean;
  }>(),
  {
    placeholder: 'Search by keyword...',
    value: '',
    dropup: false,
    disabled: false,
  },
);
const emit = defineEmits<{
  (e: 'submit', query: string): void;
  (e: 'change', query: string): void;
  (e: 'stage', staged: Array<SuggestionItem<T>>): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
  (e: 'ready', inst: AutocompleteInstance<T>): void;
}>();

const host = ref<HTMLElement | null>(null);
let inst: AutocompleteInstance<T> | null = null;

onMounted(() => {
  if (!host.value) return;
  inst = createAutocomplete<T>({
    container: host.value,
    placeholder: props.placeholder,
    value: props.value,
    items: props.items,
    groups: props.groups,
    groupOrder: props.groupOrder,
    dropup: props.dropup,
    disabled: props.disabled,
    minChars: props.minChars,
    maxHistory: props.maxHistory,
    history: props.history,
    historyAdapter: props.historyAdapter,
    maxItemsPerGroup: props.maxItemsPerGroup,
    maxTotalItems: props.maxTotalItems,
    virtualizeThreshold: props.virtualizeThreshold,
    showStatusBar: props.showStatusBar,
    showHistory: props.showHistory,
    showApplyButton: props.showApplyButton,
    className: props.className,
    locale: props.locale,
    submitIcon: props.submitIcon,
    color: props.color,
    colorDark: props.colorDark,
    borderRadius: props.borderRadius,
    tokens: props.tokens,
    name: props.name,
    debug: props.debug,
    onSubmit: (q) => emit('submit', q),
    onChange: (q) => emit('change', q),
    onStageChange: (s) => emit('stage', s),
    onFocus: () => emit('focus'),
    onBlur: () => emit('blur'),
  });
  if (inst) emit('ready', inst);
});

watch(
  () => props.items,
  (v) => v && inst?.setItems(v),
  { deep: true },
);
watch(
  () => props.value,
  (v) => {
    if (v !== undefined && inst && inst.getQuery() !== v) inst.setQuery(v, { focus: false });
  },
);
watch(
  () => props.disabled,
  (v) => (v ? inst?.disable() : inst?.enable()),
);
watch(
  () => props.dropup,
  (v) => v !== undefined && inst?.setDropup(v),
);
watch(
  () => props.groups,
  (v) => v && v.length && inst?.setGroups(v),
  { deep: true },
);
watch([() => props.color, () => props.colorDark], ([c, d]) => {
  if (c && inst) inst.setTheme(c, d);
});
watch(
  () => props.borderRadius,
  (v) => v !== undefined && inst?.setBorderRadius(v),
);

onUnmounted(() => inst?.destroy());
defineExpose({
  getQuery: () => inst?.getQuery() ?? '',
  getFormValue: () => inst?.getFormValue() ?? '',
  setQuery: (v: string) => inst?.setQuery(v),
  clear: () => inst?.clear(),
  reload: () => inst?.reload(),
  instance: () => inst,
});
</script>

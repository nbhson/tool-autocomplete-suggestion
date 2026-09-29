<template>
  <div ref="host" style="width: 100%"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { createAutocomplete } from 'sautocomplete-suggestion';
import type { AutocompleteInstance, SuggestionItem } from 'sautocomplete-suggestion';
import 'sautocomplete-suggestion/dist/styles.css';

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    value?: string;
    items?: SuggestionItem[];
    groupOrder?: string[];
    dropup?: boolean;
    disabled?: boolean;
    submitIcon?: string;
    color?: string;
    colorDark?: string;
    borderRadius?: string | number;
  }>(),
  { placeholder: 'Search by keyword...', value: '', dropup: false, disabled: false },
);
const emit = defineEmits<{
  (e: 'submit', query: string): void;
  (e: 'change', query: string): void;
  (e: 'stage', staged: SuggestionItem[]): void;
}>();

const host = ref<HTMLElement | null>(null);
let inst: AutocompleteInstance | null = null;

onMounted(() => {
  if (!host.value) return;
  inst = createAutocomplete({
    container: host.value,
    placeholder: props.placeholder,
    value: props.value,
    items: props.items,
    groupOrder: props.groupOrder,
    dropup: props.dropup,
    disabled: props.disabled,
    submitIcon: props.submitIcon,
    color: props.color,
    colorDark: props.colorDark,
    borderRadius: props.borderRadius,
    onSubmit: (q) => emit('submit', q),
    onChange: (q) => emit('change', q),
    onStageChange: (s) => emit('stage', s),
  });
});

watch(() => props.items, (v) => v && inst?.setItems(v), { deep: true });

onUnmounted(() => inst?.destroy());
defineExpose({ getQuery: () => inst?.getQuery() ?? '', setQuery: (v: string) => inst?.setQuery(v) });
</script>

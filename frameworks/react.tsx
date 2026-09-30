import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createAutocomplete } from 'sautocomplete-suggestion';
import type { AutocompleteInstance, AutocompleteOptions, SuggestionItem } from 'sautocomplete-suggestion';
import 'sautocomplete-suggestion/dist/styles.css';

export interface SAutocompleteProps<T = unknown>
  extends Omit<AutocompleteOptions<T>, 'container' | 'onReady' | 'onChange' | 'onStageChange'> {
  onSubmit?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  onStagedChange?: (staged: Array<SuggestionItem<T>>) => void;
  onReady?: (instance: AutocompleteInstance<T> | null) => void;
}

export interface SAutocompleteHandle<T = unknown> {
  instance: AutocompleteInstance<T> | null;
  getQuery(): string;
  setQuery(v: string): void;
  clear(): void;
  focus(): void;
  submit(q?: string): void;
  reload(): void;
}

function SAutocompleteInner<T>(
  { onSubmit, onQueryChange, onStagedChange, onReady, ...opts }: SAutocompleteProps<T>,
  ref: React.Ref<SAutocompleteHandle<T>>,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<AutocompleteInstance<T> | null>(null);
  const cbRef = useRef({ onSubmit, onQueryChange, onStagedChange });
  cbRef.current = { onSubmit, onQueryChange, onStagedChange };

  // Mount once — callbacks go through refs so they never go stale
  useEffect(() => {
    if (!hostRef.current) return;
    instRef.current = createAutocomplete<T>({
      ...(opts as AutocompleteOptions<T>),
      container: hostRef.current,
      onSubmit: (q) => cbRef.current.onSubmit?.(q),
      onChange: (q) => cbRef.current.onQueryChange?.(q),
      onStageChange: (s) => cbRef.current.onStagedChange?.(s),
    });
    onReady?.(instRef.current);
    return () => {
      instRef.current?.destroy();
      instRef.current = null;
      onReady?.(null);
    };
    // Mount-once by design: callbacks flow through cbRef, props sync via effects below.
  }, []);

  // ---- controlled + dynamic prop sync (enterprise fix) ----
  useEffect(() => {
    if (opts.items && instRef.current) instRef.current.setItems(opts.items);
  }, [opts.items]);
  useEffect(() => {
    if (opts.value !== undefined && instRef.current && instRef.current.getQuery() !== opts.value) {
      instRef.current.setQuery(opts.value, { focus: false });
    }
  }, [opts.value]);
  useEffect(() => {
    if (!instRef.current) return;
    if (opts.disabled) instRef.current.disable();
    else instRef.current.enable();
  }, [opts.disabled]);
  useEffect(() => {
    if (opts.dropup !== undefined) instRef.current?.setDropup(opts.dropup);
  }, [opts.dropup]);
  useEffect(() => {
    if (opts.borderRadius !== undefined) instRef.current?.setBorderRadius(opts.borderRadius);
  }, [opts.borderRadius]);
  useEffect(() => {
    if (opts.color) instRef.current?.setTheme(opts.color, opts.colorDark);
  }, [opts.color, opts.colorDark]);
  useEffect(() => {
    if (opts.groups) instRef.current?.setGroups(opts.groups);
  }, [opts.groups]);

  useImperativeHandle(ref, () => ({
    instance: instRef.current,
    getQuery: () => instRef.current?.getQuery() ?? '',
    setQuery: (v: string) => instRef.current?.setQuery(v),
    clear: () => instRef.current?.clear(),
    focus: () => instRef.current?.focus(),
    submit: (q?: string) => instRef.current?.submit(q),
    reload: () => instRef.current?.reload(),
  }));

  return <div ref={hostRef} style={{ width: '100%' }} />;
}

export const SAutocomplete = forwardRef(SAutocompleteInner) as <T>(
  props: SAutocompleteProps<T> & { ref?: React.Ref<SAutocompleteHandle<T>> },
) => React.ReactElement;

export default SAutocomplete;

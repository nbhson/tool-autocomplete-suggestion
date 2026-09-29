import { useEffect, useRef } from 'react';
import { createAutocomplete } from 'sautocomplete-suggestion';
import type { AutocompleteInstance, AutocompleteOptions } from 'sautocomplete-suggestion';
import 'sautocomplete-suggestion/dist/styles.css';

export interface SAutocompleteProps extends Omit<AutocompleteOptions, 'container' | 'onReady'> {
  onSubmit?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  onStagedChange?: (staged: { id: string; group: string; label: string }[]) => void;
}

export function SAutocomplete({ onSubmit, onQueryChange, onStagedChange, ...opts }: SAutocompleteProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<AutocompleteInstance | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    instRef.current = createAutocomplete({
      ...opts,
      container: hostRef.current,
      onSubmit,
      onChange: onQueryChange,
      onStageChange: onStagedChange,
    });
    return () => instRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} style={{ width: '100%' }} />;
}

export default SAutocomplete;

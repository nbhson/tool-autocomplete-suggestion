// Storybook CSF stub — copy into a Storybook setup to get interactive docs.
// Requires @storybook/html (not a runtime dependency of this package).
// npx storybook@latest init --type html, then drop this file into stories/.

import { createAutocomplete } from 'sautocomplete-suggestion';
import 'sautocomplete-suggestion/dist/styles.css';

const items = [
  { id: 'l1', group: 'Language', label: 'TypeScript' },
  { id: 'f1', group: 'Framework', label: 'React' },
  { id: 't1', group: 'Tool', label: 'Vite' },
];

const mount = (el, args) => {
  el.innerHTML = '<div style="max-width:640px"></div>';
  const inst = createAutocomplete({ container: el.firstElementChild, items, ...args });
  return () => inst.destroy();
};

export default { title: 'SAutocomplete/Suggestion' };

export const Basic = {
  render: (args) => {
    const el = document.createElement('div');
    this._cleanup?.();
    this._cleanup = mount(el, args);
    return el;
  },
  args: { placeholder: 'Search languages, frameworks, tools...' },
};

export const Async = {
  render: () => {
    const el = document.createElement('div');
    const inner = document.createElement('div');
    inner.style.maxWidth = '640px';
    el.appendChild(inner);
    const inst = createAutocomplete({
      container: inner,
      debounceMs: 200,
      dataSource: async ({ query }) => {
        await new Promise((r) => setTimeout(r, 300));
        return items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));
      },
    });
    setTimeout(() => inst.setQuery('rea'), 0);
    return el;
  },
};

export const ThemedRTL = {
  render: () => {
    const el = document.createElement('div');
    const inner = document.createElement('div');
    inner.style.maxWidth = '640px';
    el.appendChild(inner);
    createAutocomplete({
      container: inner,
      items,
      color: '#4f46e5',
      tokens: { direction: 'rtl', density: 'compact', theme: 'dark' },
    });
    return el;
  },
};

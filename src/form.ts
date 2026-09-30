/**
 * Native form integration — hidden input mirrors the query so plain
 * <form method=post> submissions and FormData include the value.
 * Framework form libs (RHF / VeeValidate / Angular Forms) can also read
 * getFormValue() directly.
 */

export function createHiddenInput(name: string, initialValue: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'hidden';
  el.name = name;
  el.value = initialValue;
  el.setAttribute('data-sa', 'form-value');
  el.tabIndex = -1;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

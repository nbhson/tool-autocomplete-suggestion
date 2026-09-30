import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { createAutocomplete } from 'sautocomplete-suggestion';
import type {
  AutocompleteInstance,
  DesignTokens,
  GroupConfig,
  HistoryAdapter,
  LocaleStrings,
  MatchMode,
  SuggestionItem,
} from 'sautocomplete-suggestion';
import 'sautocomplete-suggestion/dist/styles.css';

/**
 * Fully dynamic Angular wrapper — every option is an @Input(),
 * every event is an @Output(). Enterprise edition: async dataSource,
 * history adapter, design tokens, form name, virtualization.
 */
@Component({
  selector: 's-autocomplete-suggestion',
  standalone: true,
  imports: [CommonModule],
  template: `<div #host style="width:100%"></div>`,
  styles: [`:host { display: block; width: 100%; }`],
})
export class SAutocompleteSuggestionComponent<T = unknown>
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLElement>;

  // ---- Dynamic config inputs ----
  @Input() placeholder = 'Search by keyword...';
  @Input() value = '';
  @Input() items: Array<SuggestionItem<T>> = [];
  @Input() dataSource?: (req: { query: string; fullQuery: string; signal: AbortSignal }) => Promise<Array<SuggestionItem<T>>>;
  @Input() debounceMs = 200;
  @Input() groups: GroupConfig[] = [];
  @Input() groupOrder: string[] = [];
  @Input() dropup = false;
  @Input() disabled = false;
  @Input() minChars = 1;
  @Input() maxHistory = 5;
  @Input() history: string[] = [];
  @Input() historyAdapter?: HistoryAdapter;
  @Input() matchMode: MatchMode = 'accent-insensitive';
  @Input() maxItemsPerGroup = 0;
  @Input() maxTotalItems = 0;
  @Input() virtualizeThreshold = 200;
  @Input() showStatusBar = true;
  @Input() showHistory = true;
  @Input() showApplyButton = true;
  @Input() className = '';
  @Input() locale: LocaleStrings = {};
  @Input() submitIcon?: string;
  @Input() color?: string;
  @Input() colorDark?: string;
  @Input() borderRadius?: string | number;
  @Input() tokens?: DesignTokens;
  @Input() name?: string;
  @Input() debug = false;

  // ---- Events ----
  @Output() querySubmit = new EventEmitter<string>();
  @Output() queryChange = new EventEmitter<string>();
  @Output() stagedChange = new EventEmitter<Array<SuggestionItem<T>>>();
  @Output() focused = new EventEmitter<void>();
  @Output() blurred = new EventEmitter<void>();
  @Output() ready = new EventEmitter<AutocompleteInstance<T>>();
  @Output() asyncError = new EventEmitter<unknown>();

  private inst: AutocompleteInstance<T> | null = null;

  ngAfterViewInit(): void {
    this.inst = createAutocomplete<T>({
      container: this.host.nativeElement,
      placeholder: this.placeholder,
      value: this.value,
      items: this.items,
      dataSource: this.dataSource,
      debounceMs: this.debounceMs,
      groups: this.groups.length ? this.groups : undefined,
      groupOrder: this.groupOrder.length ? this.groupOrder : undefined,
      dropup: this.dropup,
      disabled: this.disabled,
      minChars: this.minChars,
      maxHistory: this.maxHistory,
      history: this.history,
      historyAdapter: this.historyAdapter,
      matchMode: this.matchMode,
      maxItemsPerGroup: this.maxItemsPerGroup,
      maxTotalItems: this.maxTotalItems,
      virtualizeThreshold: this.virtualizeThreshold,
      showStatusBar: this.showStatusBar,
      showHistory: this.showHistory,
      showApplyButton: this.showApplyButton,
      className: this.className,
      locale: this.locale,
      submitIcon: this.submitIcon,
      color: this.color,
      colorDark: this.colorDark,
      borderRadius: this.borderRadius,
      tokens: this.tokens,
      name: this.name,
      debug: this.debug,
      onSubmit: (q) => this.querySubmit.emit(q),
      onChange: (q) => this.queryChange.emit(q),
      onStageChange: (s) => this.stagedChange.emit(s),
      onFocus: () => this.focused.emit(),
      onBlur: () => this.blurred.emit(),
      onAsyncError: (e) => this.asyncError.emit(e),
    });
    this.ready.emit(this.inst);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.inst) return;
    if (changes['items'] && this.items) this.inst.setItems(this.items);
    if (changes['groups'] && this.groups?.length) this.inst.setGroups(this.groups);
    if (changes['disabled']) (this.disabled ? this.inst.disable() : this.inst.enable());
    if (changes['dropup'] && this.dropup !== undefined) this.inst.setDropup(this.dropup);
    if (changes['color'] || changes['colorDark']) {
      if (this.color) this.inst.setTheme(this.color, this.colorDark);
    }
    if (changes['borderRadius'] && this.borderRadius !== undefined) {
      this.inst.setBorderRadius(this.borderRadius);
    }
    if (changes['value'] && this.value !== undefined) {
      if (this.inst.getQuery() !== this.value) this.inst.setQuery(this.value, { focus: false });
    }
  }

  getQuery(): string { return this.inst?.getQuery() ?? ''; }
  getText(): string { return this.inst?.getText() ?? ''; }
  getFormValue(): string { return this.inst?.getFormValue() ?? ''; }
  isEmpty(): boolean { return this.inst?.isEmpty() ?? true; }
  isLoading(): boolean { return this.inst?.isLoading() ?? false; }
  getCharacterCount(): number { return this.inst?.getCharacterCount() ?? 0; }
  getWordCount(): number { return this.inst?.getWordCount() ?? 0; }
  setQuery(v: string): void { this.inst?.setQuery(v); }
  clear(): void { this.inst?.clear(); }
  focus(): void { this.inst?.focus(); }
  submit(q?: string): void { this.inst?.submit(q); }
  reload(): void { this.inst?.reload(); }
  setDropup(v: boolean): void { this.inst?.setDropup(v); }
  setBorderRadius(v: string | number): void { this.inst?.setBorderRadius(v); }

  ngOnDestroy(): void { this.inst?.destroy(); }
}

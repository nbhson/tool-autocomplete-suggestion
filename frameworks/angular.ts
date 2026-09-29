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
import type { AutocompleteInstance, GroupConfig, LocaleStrings, SuggestionItem } from 'sautocomplete-suggestion';
import 'sautocomplete-suggestion/dist/styles.css';

/**
 * Fully dynamic Angular wrapper — every option is an @Input(),
 * every event is an @Output().
 */
@Component({
  selector: 's-autocomplete-suggestion',
  standalone: true,
  imports: [CommonModule],
  template: `<div #host style="width:100%"></div>`,
  styles: [`:host { display: block; width: 100%; }`],
})
export class SAutocompleteSuggestionComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLElement>;

  // ---- Dynamic config inputs ----
  @Input() placeholder = 'Search by keyword...';
  @Input() value = '';
  @Input() items: SuggestionItem[] = [];
  @Input() groups: GroupConfig[] = [];
  @Input() groupOrder: string[] = [];
  @Input() dropup = false;
  @Input() disabled = false;
  @Input() minChars = 1;
  @Input() maxHistory = 5;
  @Input() history: string[] = [];
  @Input() maxItemsPerGroup = 0;
  @Input() maxTotalItems = 0;
  @Input() showStatusBar = true;
  @Input() showHistory = true;
  @Input() showApplyButton = true;
  @Input() className = '';
  @Input() locale: LocaleStrings = {};
  @Input() submitIcon?: string;
  @Input() color?: string;
  @Input() colorDark?: string;
  @Input() borderRadius?: string | number;

  // ---- Events ----
  @Output() querySubmit = new EventEmitter<string>();
  @Output() queryChange = new EventEmitter<string>();
  @Output() stagedChange = new EventEmitter<SuggestionItem[]>();
  @Output() focused = new EventEmitter<void>();
  @Output() blurred = new EventEmitter<void>();
  @Output() ready = new EventEmitter<AutocompleteInstance>();

  private inst: AutocompleteInstance | null = null;

  ngAfterViewInit(): void {
    this.inst = createAutocomplete({
      container: this.host.nativeElement,
      placeholder: this.placeholder,
      value: this.value,
      items: this.items,
      groups: this.groups.length ? this.groups : undefined,
      groupOrder: this.groupOrder.length ? this.groupOrder : undefined,
      dropup: this.dropup,
      disabled: this.disabled,
      minChars: this.minChars,
      maxHistory: this.maxHistory,
      history: this.history,
      maxItemsPerGroup: this.maxItemsPerGroup,
      maxTotalItems: this.maxTotalItems,
      showStatusBar: this.showStatusBar,
      showHistory: this.showHistory,
      showApplyButton: this.showApplyButton,
      className: this.className,
      locale: this.locale,
      submitIcon: this.submitIcon,
      color: this.color,
      colorDark: this.colorDark,
      borderRadius: this.borderRadius,
      onSubmit: (q) => this.querySubmit.emit(q),
      onChange: (q) => this.queryChange.emit(q),
      onStageChange: (s) => this.stagedChange.emit(s),
      onFocus: () => this.focused.emit(),
      onBlur: () => this.blurred.emit(),
    });
    this.ready.emit(this.inst);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.inst) return;
    if (changes['items'] && this.items) this.inst.setItems(this.items);
    if (changes['groups'] && this.groups?.length) this.inst.setGroups(this.groups);
    if (changes['disabled']) (this.disabled ? this.inst.disable() : this.inst.enable());
    if (changes['color']) {
      if (this.color) this.inst.getElement().style.setProperty('--sa-accent', this.color);
      else this.inst.getElement().style.removeProperty('--sa-accent');
    }
    if (changes['colorDark']) {
      if (this.colorDark) this.inst.getElement().style.setProperty('--sa-accent-dark', this.colorDark);
      else this.inst.getElement().style.removeProperty('--sa-accent-dark');
    }
    if (changes['borderRadius'] && this.borderRadius !== undefined) {
      this.inst.setBorderRadius(this.borderRadius);
    }
    if (changes['submitIcon'] && this.submitIcon) {
      const btn = this.inst.getElement().querySelector('.sa-submit');
      if (btn) btn.innerHTML = this.submitIcon;
    }
    if (changes['value'] && this.value !== undefined) {
      if (this.inst.getQuery() !== this.value) this.inst.setQuery(this.value, { focus: false });
    }
  }

  getQuery(): string { return this.inst?.getQuery() ?? ''; }
  getText(): string { return this.inst?.getText() ?? ''; }
  isEmpty(): boolean { return this.inst?.isEmpty() ?? true; }
  getCharacterCount(): number { return this.inst?.getCharacterCount() ?? 0; }
  getWordCount(): number { return this.inst?.getWordCount() ?? 0; }
  setQuery(v: string): void { this.inst?.setQuery(v); }
  clear(): void { this.inst?.clear(); }
  focus(): void { this.inst?.focus(); }
  submit(q?: string): void { this.inst?.submit(q); }
  setDropup(v: boolean): void { this.inst?.setDropup(v); }
  setBorderRadius(v: string | number): void { this.inst?.setBorderRadius(v); }

  ngOnDestroy(): void { this.inst?.destroy(); }
}

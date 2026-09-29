/**
 * Default group color themes (badge colors per group).
 * Keys are matched by group name; unknown groups fall back to slate.
 */
export const GROUP_THEME_ORDER = [
  'Language',
  'Framework',
  'Tool',
  'Platform',
  'License',
  'Topic',
];

const THEMES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Language: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe', dot: '#3b82f6' },
  Framework: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0', dot: '#10b981' },
  Tool: { bg: '#fef3c7', text: '#92400e', border: '#fde68a', dot: '#f59e0b' },
  Platform: { bg: '#ffe4e6', text: '#9f1239', border: '#fecdd3', dot: '#f43f5e' },
  License: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff', dot: '#a855f7' },
  Topic: { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe', dot: '#6366f1' },
};

export function themeForGroup(name: string) {
  return (
    THEMES[name] ?? { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0', dot: '#64748b' }
  );
}

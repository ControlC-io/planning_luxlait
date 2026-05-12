export type ThemeKey = 'industriel' | 'corporatif' | 'compact';

export type ThemeTokens = {
  sidebarBg: string;
  sidebarText: string;
  sidebarActive: string;
  sidebarActiveBg: string;
  sidebarAccent: string;
  headerBg: string;
  bodyBg: string;
  cardBg: string;
  border: string;
  primaryBtn: string;
  primaryBtnText: string;
  weekendBg: string;
  todayBorder: string;
  label: string;
};

export const THEMES: Record<ThemeKey, ThemeTokens> = {
  industriel: {
    sidebarBg: '#1E2D3D',
    sidebarText: '#94A3B8',
    sidebarActive: '#F1F5F9',
    sidebarActiveBg: 'rgba(255,255,255,0.09)',
    sidebarAccent: '#F59E0B',
    headerBg: '#FFFFFF',
    bodyBg: '#F4F0E8',
    cardBg: '#FFFFFF',
    border: '#E2E8F0',
    primaryBtn: '#0069B4',
    primaryBtnText: '#FFFFFF',
    weekendBg: '#EDE9DF',
    todayBorder: '#F59E0B',
    label: 'Industriel Warm',
  },
  corporatif: {
    sidebarBg: '#0060A8',
    sidebarText: 'rgba(255,255,255,0.72)',
    sidebarActive: '#FFFFFF',
    sidebarActiveBg: 'rgba(255,255,255,0.16)',
    sidebarAccent: '#FFFFFF',
    headerBg: '#FFFFFF',
    bodyBg: '#EBF3FB',
    cardBg: '#FFFFFF',
    border: '#C8DDEF',
    primaryBtn: '#0060A8',
    primaryBtnText: '#FFFFFF',
    weekendBg: '#DAE9F5',
    todayBorder: '#F59E0B',
    label: 'Bleu Luxlait',
  },
  compact: {
    sidebarBg: '#F0F2F5',
    sidebarText: '#64748B',
    sidebarActive: '#1E293B',
    sidebarActiveBg: '#E2E8F0',
    sidebarAccent: '#0069B4',
    headerBg: '#FFFFFF',
    bodyBg: '#F9FAFB',
    cardBg: '#FFFFFF',
    border: '#E5E7EB',
    primaryBtn: '#1E293B',
    primaryBtnText: '#FFFFFF',
    weekendBg: '#F1F3F5',
    todayBorder: '#F59E0B',
    label: 'Compact Pro',
  },
};

export const TWEAK_DEFAULTS = {
  theme: 'industriel' as ThemeKey,
  vue: 'employe' as 'employe' | 'machine',
  density: 'balanced' as 'balanced' | 'compact',
};

export type TweakValues = typeof TWEAK_DEFAULTS;

const STORAGE_KEY = 'luxlait_tweaks_v2';

export function loadTweaks(): TweakValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...TWEAK_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<TweakValues>;
    return {
      theme: parsed.theme ?? TWEAK_DEFAULTS.theme,
      vue: parsed.vue ?? TWEAK_DEFAULTS.vue,
      density: parsed.density ?? TWEAK_DEFAULTS.density,
    };
  } catch {
    return { ...TWEAK_DEFAULTS };
  }
}

export function saveTweaks(v: TweakValues): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

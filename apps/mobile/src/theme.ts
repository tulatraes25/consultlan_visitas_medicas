/**
 * Audited from CONSULTLAN (source of truth):
 * tulatraes25/consultlan@ae53227304844904c47f979544e9b110d5d902ce
 * src/frontend/web-next/src/shared/styles/tokens.css
 * Only semantic light tokens are copied, not clinical data or code.
 */
export const palette = {
  canvas: '#F4F6F8',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  subtle: '#F8FAFC',
  border: '#E3E8EF',
  borderStrong: '#CBD5E1',
  text: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  primary: '#166534',
  primarySubtle: '#F0FDF4',
  deep: '#0B3D2A',
  deeper: '#072A1D',
  brandStrong: '#146B46',
  mint: '#DDF5E6',
  brandMuted: '#B8D8C6',
  onPrimary: '#FFFFFF',
  success: '#0E9F86',
  warning: '#B45309',
  danger: '#D64545',
  info: '#0E7CC2',
} as const;

export const spacing = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32,
} as const;
export const corners = { small: 6, medium: 10, large: 18 } as const;
export const touchSize = 44;

export const typeScale = {
  tiny: 11, caption: 12, body: 14, subtitle: 16, title: 22, hero: 28,
} as const;

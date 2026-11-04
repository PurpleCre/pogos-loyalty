import theme from '@/config/theme.json';

export const colors = {
  ...theme,
  primary: theme.brand['800'],
  accent: theme.brand['300'],
  surface: '#ffffff',
};

export const layout = { maxWidth: 760, wideWidth: 1120, gutter: 20, radius: 20 };

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  size?: 'sm' | 'md';
};

export default function LanguageSwitcher({ className, size = 'sm' }: Props) {
  const { i18n, t } = useTranslation();

  const base =
    'rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background';
  const sizing = size === 'sm' ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm';

  return (
    <label className={cn('inline-flex items-center gap-2', className)}>
      <span className="sr-only">{t('lang.label')}</span>
      <select
        aria-label={t('lang.label')}
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className={cn(base, sizing)}
      >
        <option value="en">{t('lang.english')}</option>
        <option value="hi">{t('lang.hindi')}</option>
        <option value="mr">{t('lang.marathi')}</option>
      </select>
    </label>
  );
}

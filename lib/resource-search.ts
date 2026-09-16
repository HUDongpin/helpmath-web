import type {ResourceEntry} from '@/content/types';

export function normalizeSearchValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .trim();
}

export function resourceSearchText(item: ResourceEntry) {
  return normalizeSearchValue([
    item.title,
    item.description,
    item.format,
    item.dateLabel,
    item.statusLabel,
    item.action.label,
  ].join(' '));
}

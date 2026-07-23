'use client';

import {createContext, createElement, useContext, type ReactNode} from 'react';

import type {AppLocale} from './routing';

const LocaleContext = createContext<AppLocale>('en');

export function LocaleProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: AppLocale;
}) {
  return createElement(LocaleContext.Provider, {value: locale}, children);
}

export function useLocale(): AppLocale {
  return useContext(LocaleContext);
}

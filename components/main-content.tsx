import type {ComponentPropsWithoutRef} from 'react';

type MainContentProps = Omit<ComponentPropsWithoutRef<'main'>, 'id' | 'tabIndex'>;

export function MainContent(props: MainContentProps) {
  return <main {...props} id="main-content" tabIndex={-1} />;
}

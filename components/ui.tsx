import type {ReactNode} from 'react';
import {ArrowRight} from 'lucide-react';

import {Link} from '@/i18n/navigation';

type ActionLink = {
  href: string;
  label: string;
};

export function Container({children, className = ''}: {children: ReactNode; className?: string}) {
  return <div className={`container ${className}`.trim()}>{children}</div>;
}

export function Section({
  children,
  className = '',
  id
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`section ${className}`.trim()} id={id}>
      {children}
    </section>
  );
}

export function Eyebrow({children}: {children: ReactNode}) {
  return <p className="eyebrow">{children}</p>;
}

export function Action({
  action,
  kind = 'primary',
  className = ''
}: {
  action: ActionLink;
  kind?: 'primary' | 'secondary' | 'quiet';
  className?: string;
}) {
  return (
    <Link className={`action action--${kind} ${className}`.trim()} href={action.href}>
      <span>{action.label}</span>
      <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'left'
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: 'left' | 'center';
}) {
  return (
    <header className={`section-heading section-heading--${align}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2>{title}</h2>
      {intro ? <p>{intro}</p> : null}
    </header>
  );
}

export function Callout({
  title,
  body,
  action,
  tone = 'blue',
  label
}: {
  title: string;
  body: string;
  action?: ActionLink;
  tone?: 'blue' | 'yellow' | 'coral' | 'paper';
  label?: string;
}) {
  return (
    <aside className={`callout callout--${tone}`}>
      <div>
        {label ? <p className="callout__label">{label}</p> : null}
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {action ? <Action action={action} kind={tone === 'paper' ? 'primary' : 'secondary'} /> : null}
    </aside>
  );
}

export function DotPattern({className = ''}: {className?: string}) {
  return <div aria-hidden="true" className={`dot-pattern ${className}`.trim()} />;
}

import type {ReactNode} from 'react';

type ServerIconProps = {
  'aria-hidden'?: boolean | 'true' | 'false';
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
};

function ServerIcon({
  ariaHidden,
  children,
  className,
  name,
  size = 24,
  strokeWidth = 2,
}: ServerIconProps & {
  ariaHidden?: ServerIconProps['aria-hidden'];
  children: ReactNode;
  name: string;
}) {
  return (
    <svg
      aria-hidden={ariaHidden}
      className={`lucide lucide-${name}${className ? ` ${className}` : ''}`}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function iconProps(props: ServerIconProps) {
  const {'aria-hidden': ariaHidden, ...rest} = props;
  return {ariaHidden, ...rest};
}

export function ArrowRight(props: ServerIconProps) {
  return (
    <ServerIcon name="arrow-right" {...iconProps(props)}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </ServerIcon>
  );
}

export function Sparkles(props: ServerIconProps) {
  return (
    <ServerIcon name="sparkles" {...iconProps(props)}>
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx="4" cy="20" r="2" />
    </ServerIcon>
  );
}

export function Archive(props: ServerIconProps) {
  return (
    <ServerIcon name="archive" {...iconProps(props)}>
      <rect height="5" rx="1" width="20" x="2" y="3" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </ServerIcon>
  );
}

export function FileCheck2(props: ServerIconProps) {
  return (
    <ServerIcon name="file-check-corner" {...iconProps(props)}>
      <path d="M10.5 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v6" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="m14 20 2 2 4-4" />
    </ServerIcon>
  );
}

export function SearchCheck(props: ServerIconProps) {
  return (
    <ServerIcon name="search-check" {...iconProps(props)}>
      <path d="m8 11 2 2 4-4" />
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </ServerIcon>
  );
}

export function CheckCircle2(props: ServerIconProps) {
  return (
    <ServerIcon name="circle-check" {...iconProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </ServerIcon>
  );
}

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

export function ArrowLeft(props: ServerIconProps) {
  return (
    <ServerIcon name="arrow-left" {...iconProps(props)}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </ServerIcon>
  );
}

export function BookOpenText(props: ServerIconProps) {
  return (
    <ServerIcon name="book-open-text" {...iconProps(props)}>
      <path d="M12 7v14" />
      <path d="M16 12h2" />
      <path d="M16 8h2" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      <path d="M6 12h2" />
      <path d="M6 8h2" />
    </ServerIcon>
  );
}

export function Handshake(props: ServerIconProps) {
  return (
    <ServerIcon name="handshake" {...iconProps(props)}>
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-2" />
      <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
      <path d="M3 4h8" />
    </ServerIcon>
  );
}

export function Languages(props: ServerIconProps) {
  return (
    <ServerIcon name="languages" {...iconProps(props)}>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </ServerIcon>
  );
}

export function LifeBuoy(props: ServerIconProps) {
  return (
    <ServerIcon name="life-buoy" {...iconProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.93 4.93 4.24 4.24" />
      <path d="m14.83 9.17 4.24-4.24" />
      <path d="m14.83 14.83 4.24 4.24" />
      <path d="m9.17 14.83-4.24 4.24" />
      <circle cx="12" cy="12" r="4" />
    </ServerIcon>
  );
}

export function Menu(props: ServerIconProps) {
  return (
    <ServerIcon name="menu" {...iconProps(props)}>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </ServerIcon>
  );
}

export function MessageCircleMore(props: ServerIconProps) {
  return (
    <ServerIcon name="message-circle-more" {...iconProps(props)}>
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </ServerIcon>
  );
}

export function RotateCw(props: ServerIconProps) {
  return (
    <ServerIcon name="rotate-cw" {...iconProps(props)}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </ServerIcon>
  );
}

export function Shapes(props: ServerIconProps) {
  return (
    <ServerIcon name="shapes" {...iconProps(props)}>
      <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <circle cx="17.5" cy="17.5" r="3.5" />
    </ServerIcon>
  );
}

export function ShieldCheck(props: ServerIconProps) {
  return (
    <ServerIcon name="shield-check" {...iconProps(props)}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </ServerIcon>
  );
}

export function X(props: ServerIconProps) {
  return (
    <ServerIcon name="x" {...iconProps(props)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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

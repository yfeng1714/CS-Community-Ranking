import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconFrame({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </IconFrame>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconFrame>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z" />
    </IconFrame>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 8.3A7 7 0 0 1 18.6 6L20 8M4 16l1.4 2A7 7 0 0 0 18 15.7" />
    </IconFrame>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M12 .5C5.73.5.5 5.78.5 12.08c0 5.13 3.32 9.48 7.94 11.02.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.23.7-3.91-1.56-3.91-1.56-.53-1.34-1.3-1.7-1.3-1.7-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.21 1.79 1.21 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.58-.3-5.3-1.3-5.3-5.78 0-1.28.45-2.32 1.2-3.14-.12-.3-.52-1.51.11-3.15 0 0 .98-.32 3.2 1.2a11.1 11.1 0 0 1 5.82 0c2.22-1.52 3.2-1.2 3.2-1.2.63 1.64.23 2.85.11 3.15.75.82 1.2 1.86 1.2 3.14 0 4.49-2.72 5.48-5.31 5.77.42.37.8 1.1.8 2.22 0 1.6-.01 2.89-.01 3.28 0 .31.21.68.8.56A11.58 11.58 0 0 0 23.5 12.08C23.5 5.78 18.27.5 12 .5Z" />
    </svg>
  );
}

export function BilibiliIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M5.4 3.2 7.2 5h9.6l1.8-1.8 1.3 1.3L18.4 6H20a2 2 0 0 1 2 2v10.5A2.5 2.5 0 0 1 19.5 21h-15A2.5 2.5 0 0 1 2 18.5V8a2 2 0 0 1 2-2h1.6L4.1 4.5 5.4 3.2ZM6.5 9.2v8.1h11V9.2h-11Zm2.6 1.7h1.8v4.7H9.1v-4.7Zm4.8 0h1.8v4.7h-1.8v-4.7Z" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </IconFrame>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </IconFrame>
  );
}

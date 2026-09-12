/**
 * The player's marks.
 *
 * Nine small shapes do not justify a dependency, and a library's house style
 * would be the one visual thing on this site that came from somewhere else.
 * All of them are drawn on the same 16-unit grid: solid where a shape needs
 * weight at 12px (play, pause), a single 1.4 stroke everywhere else, square
 * ends, no rounding. They inherit `currentColor`, so the bar controls the tone.
 */

type IconProps = { className?: string };

function Svg({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4.4 2.7 13 8l-8.6 5.3Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4.6 2.9h2.1v10.2H4.6ZM9.3 2.9h2.1v10.2H9.3Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function SoundOnIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M2 6h2.4L7.6 3.2v9.6L4.4 10H2Z" fill="currentColor" stroke="none" />
      <path d="M10.1 5.6a3.4 3.4 0 0 1 0 4.8M12.3 3.5a6.4 6.4 0 0 1 0 9" />
    </Svg>
  );
}

export function SoundOffIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M2 6h2.4L7.6 3.2v9.6L4.4 10H2Z" fill="currentColor" stroke="none" />
      <path d="m10.2 6.2 3.6 3.6M13.8 6.2l-3.6 3.6" />
    </Svg>
  );
}

export function FullscreenEnterIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
    </Svg>
  );
}

export function FullscreenExitIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" />
    </Svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M13 8H3M6.8 4.2 3 8l3.8 3.8" />
    </Svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 8h10M9.2 4.2 13 8l-3.8 3.8" />
    </Svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m3.4 3.4 9.2 9.2M12.6 3.4l-9.2 9.2" />
    </Svg>
  );
}

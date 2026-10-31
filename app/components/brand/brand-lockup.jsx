import { APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

export function BrandIcon({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={APP_NAME}
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      <title>{APP_NAME}</title>
      <g transform="matrix(0.98 0 0 0.98 1.21516 1.18032)">
        <rect
          x="0"
          y="10"
          width="52"
          height="40"
          rx="8"
          transform="rotate(-13 0 10)"
          className="fill-primary opacity-40 dark:opacity-55"
        />
        <rect
          x="13"
          y="8"
          width="50"
          height="40"
          rx="8"
          transform="rotate(9 13 8)"
          className="fill-primary"
          opacity="0.58"
        />
        <rect
          x="7"
          y="17"
          width="50"
          height="46"
          rx="9"
          className="fill-primary"
        />
        <path
          d="M18 31H46"
          className="stroke-primary-foreground"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M18 40H44"
          className="stroke-primary-foreground"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M18 49H39"
          className="stroke-primary-foreground"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function BrandLockup({ className, iconClassName, wordmarkClassName }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandIcon className={cn("size-6", iconClassName)} />
      <img
        src="/branding/app-name-lightmode.svg"
        alt=""
        aria-hidden="true"
        className={cn("h-7 w-auto shrink-0 dark:invert", wordmarkClassName)}
      />
    </div>
  );
}

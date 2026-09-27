import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "dark" | "green" | "outline";

function classes(variant: Variant, extra?: string) {
  return [styles.button, styles[variant], extra].filter(Boolean).join(" ");
}

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export function Button({
  variant = "dark",
  arrow = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; arrow?: boolean }) {
  return (
    <button className={classes(variant, className)} {...rest}>
      <span>{children}</span>
      {arrow && <Arrow />}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "dark",
  arrow = false,
  children,
}: { href: string; variant?: Variant; arrow?: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={classes(variant)}>
      <span>{children}</span>
      {arrow && <Arrow />}
    </Link>
  );
}

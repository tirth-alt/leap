import type { HTMLAttributes } from "react";
import styles from "./Chip.module.css";

export function Chip({
  tone = "outline",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: "outline" | "filled" }) {
  return <span className={[styles.chip, styles[tone], className].filter(Boolean).join(" ")} {...rest} />;
}

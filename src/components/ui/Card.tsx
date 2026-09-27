import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

export function Card({
  tone = "surface",
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: "surface" | "cream" | "green" }) {
  return <div className={[styles.card, styles[tone], className].filter(Boolean).join(" ")} {...rest} />;
}

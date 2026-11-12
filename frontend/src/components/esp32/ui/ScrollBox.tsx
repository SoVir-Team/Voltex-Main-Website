import type { ReactNode } from "react";
import styles from "./ScrollBox.module.css";

/** A wide table or drawing that scrolls sideways on narrow screens, keyboard-scrollable too. */
export function ScrollBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.scroll} tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

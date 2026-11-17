import type { ReactNode } from "react";

export const RICH = {
  nw: (chunks: ReactNode) => (
    <span className="whitespace-nowrap">{chunks}</span>
  ),
  b: (chunks: ReactNode) => <b>{chunks}</b>,
  br: () => <br />,
};

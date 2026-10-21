import { notFound } from "next/navigation";

/** `/en/없는-주소`, `/en/w/x` 를 잡아 그 언어의 404(`app/[lang]/not-found.tsx`)로 보낸다. */
export default function MarketingCatchAll() {
  notFound();
}

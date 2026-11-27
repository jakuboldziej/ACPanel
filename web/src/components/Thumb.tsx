import { useState } from "react";
import "./Thumb.css";

export function Thumb(props: { src: string | null; kind?: "preview" | "badge" | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const cls = `thumb ${props.large ? "large" : ""} ${props.kind === "badge" ? "badge" : ""}`;
  if (!props.src || failed) return <span className={`${cls} none`} />;
  return <img className={cls} src={props.src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

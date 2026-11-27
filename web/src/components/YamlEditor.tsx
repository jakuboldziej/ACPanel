import type { KeyboardEvent } from "react";
import "./YamlEditor.css";

export function YamlEditor(props: { value: string; onChange?: (v: string) => void; readOnly?: boolean; rows?: number }) {
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || props.readOnly) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const next = `${value.slice(0, start)}  ${value.slice(end)}`;
    props.onChange?.(next);
    requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
  }

  return (
    <textarea
      className="yaml-editor"
      spellCheck={false}
      readOnly={props.readOnly}
      rows={props.rows ?? 20}
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

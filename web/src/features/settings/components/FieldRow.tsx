import type { FieldInfo, FieldValue } from "../api";

export function FieldRow(props: { field: FieldInfo; value: FieldValue; changed: boolean; onChange: (v: FieldValue) => void }) {
  const { field, value } = props;

  let input;
  if (field.type === "boolean") {
    input = <input type="checkbox" checked={value === true} onChange={(e) => props.onChange(e.target.checked)} />;
  } else if (field.enum) {
    input = (
      <select value={value === null ? "" : String(value)} onChange={(e) => props.onChange(e.target.value || null)}>
        {field.nullable && <option value="">(empty)</option>}
        {field.enum.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "integer" || field.type === "number") {
    input = (
      <input
        type="number"
        step={field.type === "integer" ? 1 : "any"}
        value={value === null ? "" : String(value)}
        placeholder={field.nullable ? "(empty)" : ""}
        onChange={(e) => props.onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    );
  } else {
    input = (
      <input
        type="text"
        value={value === null ? "" : String(value)}
        placeholder={field.nullable ? "(empty)" : ""}
        onChange={(e) => props.onChange(e.target.value === "" && field.nullable ? null : e.target.value)}
      />
    );
  }

  return (
    <li className={`card field ${props.changed ? "changed" : ""}`}>
      <div className="field-main">
        <label className="field-key mono">{field.key}</label>
        {input}
      </div>
      {field.description && <p className="field-desc muted">{field.description}</p>}
      {field.default !== undefined && field.default !== null && (
        <p className="field-default muted">Default: {String(field.default)}</p>
      )}
    </li>
  );
}

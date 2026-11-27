import type { ReactNode } from "react";

export function SectionCard(props: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card sess-card">
      <div className="sess-card-head">
        <h3>{props.title}</h3>
        {props.aside}
      </div>
      {props.children}
    </section>
  );
}

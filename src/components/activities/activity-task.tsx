import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** Keep the requested action beside the response, above any answer controls. */
export function ActivityTask({ children, id, htmlFor }: {
  children: ReactNode; id?: string; htmlFor?: string;
}) {
  return <div className="activity-task">
    <span className="activity-task-icon"><ArrowRight size={21} aria-hidden="true" /></span>
    <div className="activity-task-copy">
      <span className="activity-task-eyebrow">Sua tarefa</span>
      {htmlFor
        ? <label id={id} htmlFor={htmlFor} className="activity-task-text">{children}</label>
        : <div id={id} className="activity-task-text">{children}</div>}
    </div>
  </div>;
}

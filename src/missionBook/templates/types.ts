import type { ClassifiedQuestion } from "../classify";

export interface TemplateProps {
  q: ClassifiedQuestion;
  gradeLevel: string;
  onUpdate: (field: string, value: string) => void;
}

export type TemplateComponent = React.ComponentType<TemplateProps>;

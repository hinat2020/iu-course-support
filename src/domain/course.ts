export type AcademicYear = 2026;

export type RequirementType =
  | "required"
  | "required_elective"
  | "elective";

export type Course = {
  id: string;
  name: string;
  credits: number;
  requirementType: RequirementType;
  requirementGroups: string[];
  grade: number;
  semester: "first" | "second" | "both";
  category: {
    major: string;
    middle?: string;
    minor?: string;
  };
  specialCourseType?:
    | "innovation_lecture"
    | "innovation_method"
    | null;
};

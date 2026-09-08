import rawMetadata from "./metadata.json";

export type AcademicDataMetadata = {
  academicYear: 2026;
  lastUpdated: string;
  target: {
    admissionYear: 2026;
    grade: 1;
    semester: "second";
  };
};

export const academicDataMetadata = rawMetadata as AcademicDataMetadata;

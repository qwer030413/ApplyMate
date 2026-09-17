export type Platform = "greenhouse" | "smartrecruiters" | "workday" | "generic";
export interface DetectedField {
  id: string;
  label: string;
  section: string;
  index: number;
  type: string;
  required: boolean;
  filled: boolean;
  options: string[];
  accept?: string;
}
export interface FieldAssignment {
  id: string;
  value?: string;
  reason?: string;
  attachment?: import('./resume-file').ResumeAttachment;
}
export interface FillResult {
  filled: string[];
  preserved: string[];
  unresolved: { label: string; reason: string }[];
  attached?: string[];
}
export interface ApplicationRun {
  status: "idle" | "running" | "paused" | "stopped" | "review";
  platform: Platform;
  step: number;
  message: string;
  result: FillResult;
  documentId: string;
}
export interface PageScan {
  platform: Platform;
  fields: DetectedField[];
  blockers: string[];
  final: boolean;
}

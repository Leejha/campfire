export interface StudyInvite {
  v: "1";
  date: string;
  time: string;
  title: string;
}

export interface KstNow {
  date: string;
  time: string;
}

export interface StudyInviteRawInput {
  v: readonly string[];
  date: readonly string[];
  time: readonly string[];
  title: readonly string[];
}

export interface StudyInviteFieldErrors {
  v: string;
  date: string;
  time: string;
  title: string;
}

export interface ValidStudyInviteNormalization {
  isValid: true;
  invite: StudyInvite;
  fieldErrors: StudyInviteFieldErrors;
  pastTimeWarning: string;
}

export interface InvalidStudyInviteNormalization {
  isValid: false;
  fieldErrors: StudyInviteFieldErrors;
}

export type StudyInviteNormalization =
  | ValidStudyInviteNormalization
  | InvalidStudyInviteNormalization;

export interface InviteFormValues {
  date: string;
  time: string;
  title: string;
}

import type {
  InviteFormValues,
  KstNow,
  StudyInvite,
  StudyInviteFieldErrors,
  StudyInviteNormalization,
  StudyInviteRawInput,
} from "./models";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

function normalizeTitle({ title }: Readonly<{ title: string }>): string {
  return title.replace(/\s+/gu, " ").trim();
}

function getSingleValue({ values }: Readonly<{ values: readonly string[] }>): string {
  return values.length === 1 ? values[0] : "";
}

function getRequiredValueError({ values, message }: Readonly<{ values: readonly string[]; message: string }>): string {
  return values.length === 1 ? "" : message;
}

function isLeapYear({ year }: Readonly<{ year: number }>): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate({ date }: Readonly<{ date: string }>): boolean {
  const matchedDate = DATE_PATTERN.exec(date);

  if (matchedDate === null) return false;

  const year = Number(matchedDate[1]);
  const month = Number(matchedDate[2]);
  const day = Number(matchedDate[3]);
  const monthDays = [31, isLeapYear({ year }) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const lastDay = monthDays[month - 1];

  return month >= 1 && month <= 12 && lastDay !== undefined && day >= 1 && day <= lastDay;
}

function isTwentyFourHourTime({ time }: Readonly<{ time: string }>): boolean {
  const matchedTime = TIME_PATTERN.exec(time);

  if (matchedTime === null) return false;

  const hour = Number(matchedTime[1]);
  const minute = Number(matchedTime[2]);

  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function hasErrors({ fieldErrors }: Readonly<{ fieldErrors: StudyInviteFieldErrors }>): boolean {
  return Object.values(fieldErrors).some((error) => error.length > 0);
}

export function createStudyInviteRawInput({ values }: Readonly<{ values: InviteFormValues }>): StudyInviteRawInput {
  return {
    v: ["1"],
    date: [values.date],
    time: [values.time],
    title: [values.title],
  };
}

export function createStudyInviteRawInputFromSearchParams({
  searchParams,
}: Readonly<{ searchParams: URLSearchParams }>): StudyInviteRawInput {
  return {
    v: searchParams.getAll("v"),
    date: searchParams.getAll("date"),
    time: searchParams.getAll("time"),
    title: searchParams.getAll("title"),
  };
}

export function normalizeStudyInvite({
  input,
  todayKst,
}: Readonly<{ input: StudyInviteRawInput; todayKst: KstNow }>): StudyInviteNormalization {
  const versionError = getRequiredValueError({
    values: input.v,
    message: "초대 형식을 확인해 주세요.",
  });
  const dateValue = getSingleValue({ values: input.date });
  const timeValue = getSingleValue({ values: input.time });
  const titleValue = normalizeTitle({ title: getSingleValue({ values: input.title }) });
  const fieldErrors: StudyInviteFieldErrors = {
    v: versionError || (getSingleValue({ values: input.v }) === "1" ? "" : "초대 형식을 확인해 주세요."),
    date: getRequiredValueError({ values: input.date, message: "날짜를 한 번만 입력해 주세요." }),
    time: getRequiredValueError({ values: input.time, message: "시간을 한 번만 입력해 주세요." }),
    title: getRequiredValueError({ values: input.title, message: "제목을 한 번만 입력해 주세요." }),
  };

  if (fieldErrors.date.length === 0 && !isCalendarDate({ date: dateValue })) {
    fieldErrors.date = "실제 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.";
  }

  if (fieldErrors.time.length === 0 && !isTwentyFourHourTime({ time: timeValue })) {
    fieldErrors.time = "24시간제 HH:mm 형식으로 입력해 주세요.";
  }

  if (fieldErrors.title.length === 0 && CONTROL_CHARACTER_PATTERN.test(titleValue)) {
    fieldErrors.title = "제목에는 제어 문자를 사용할 수 없어요.";
  }

  if (fieldErrors.title.length === 0 && (titleValue.length < 1 || titleValue.length > 60)) {
    fieldErrors.title = "제목은 공백을 제외하고 1~60자로 입력해 주세요.";
  }

  if (fieldErrors.date.length === 0 && dateValue < todayKst.date) {
    fieldErrors.date = "오늘 또는 미래 날짜를 선택해 주세요.";
  }

  if (hasErrors({ fieldErrors })) return { isValid: false, fieldErrors };

  const invite: StudyInvite = { v: "1", date: dateValue, time: timeValue, title: titleValue };
  const isPastTimeToday = dateValue === todayKst.date && timeValue < todayKst.time;

  return {
    isValid: true,
    invite,
    fieldErrors,
    pastTimeWarning: isPastTimeToday ? "오늘의 지난 시간이에요. 내용을 확인한 뒤 공유해 주세요." : "",
  };
}

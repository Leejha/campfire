import type { KstNow } from "./models";

const KST_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function getPartValue({ parts, type }: Readonly<{ parts: Intl.DateTimeFormatPart[]; type: Intl.DateTimeFormatPartTypes }>): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getKstNow({ now }: Readonly<{ now: Date }>): KstNow {
  const parts = KST_PARTS_FORMATTER.formatToParts(now);
  const year = getPartValue({ parts, type: "year" });
  const month = getPartValue({ parts, type: "month" });
  const day = getPartValue({ parts, type: "day" });
  const hour = getPartValue({ parts, type: "hour" });
  const minute = getPartValue({ parts, type: "minute" });

  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

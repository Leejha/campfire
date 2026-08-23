import type { StudyInvite } from "./models";

export function serializeStudyInvite({ invite }: Readonly<{ invite: StudyInvite }>): string {
  const searchParams = new URLSearchParams();
  searchParams.set("v", invite.v);
  searchParams.set("date", invite.date);
  searchParams.set("time", invite.time);
  searchParams.set("title", invite.title);

  return `/invite/open?${searchParams.toString()}`;
}

export function formatStudyInvitePreview({ invite }: Readonly<{ invite: StudyInvite }>): string {
  return `스터디 초대\n제목: ${invite.title}\n날짜: ${invite.date}\n시간: ${invite.time}`;
}

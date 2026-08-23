import type { ReactElement } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components";

import type { StudyInviteNormalization } from "../models";

interface StudyInviteArrivalProps {
  normalization: StudyInviteNormalization;
}

export function StudyInviteArrival({ normalization }: Readonly<StudyInviteArrivalProps>): ReactElement {
  if (!normalization.isValid) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-4 py-8 sm:px-6">
        <Card className="w-full">
          <CardHeader><CardTitle><h1 className="text-2xl font-semibold tracking-tight">초대 링크를 확인해 주세요</h1></CardTitle></CardHeader>
          <CardContent><p className="leading-7 text-muted-foreground" role="alert">링크가 올바르지 않아요. 이 링크는 공식 증빙이 아닌 공유 안내예요. 일정은 별도로 확인해 주세요.</p></CardContent>
        </Card>
      </main>
    );
  }

  const { invite, pastTimeWarning } = normalization;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-4 py-8 sm:px-6">
      <Card className="w-full">
        <CardHeader className="grid gap-3">
          <p className="text-sm font-semibold text-primary">스터디 초대</p>
          <CardTitle><h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{invite.title}</h1></CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">이 링크는 공식 증빙이 아닌 공유 안내예요. 일정은 별도로 확인해 주세요.</p>
        </CardHeader>
        <CardContent className="grid gap-5">
          <dl className="grid gap-4 rounded-lg bg-muted p-4 sm:grid-cols-2">
            <div className="grid gap-1"><dt className="text-sm text-muted-foreground">날짜</dt><dd className="font-semibold"><time dateTime={invite.date}>{invite.date}</time></dd></div>
            <div className="grid gap-1"><dt className="text-sm text-muted-foreground">시간</dt><dd className="font-semibold"><time dateTime={`${invite.date}T${invite.time}`}>{invite.time}</time></dd></div>
          </dl>
          {pastTimeWarning ? <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-6" role="status">{pastTimeWarning}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}

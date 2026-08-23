import type { ReactElement } from "react";

import { StudyInviteCreator, getKstNow } from "~/features/study-invite";
import type { KstNow } from "~/features/study-invite";
import type { Route } from "./+types/invite";

interface InviteLoaderData {
  todayKst: KstNow;
}

export async function loader(): Promise<InviteLoaderData> {
  return { todayKst: getKstNow({ now: new Date() }) };
}

export default function Invite({ loaderData }: Route.ComponentProps): ReactElement {
  return (
    <>
      <title>Campfire | 초대 링크 만들기</title>
      <meta name="description" content="공개 일정만 담은 스터디 초대 링크를 만들어요." />
      <StudyInviteCreator todayKst={loaderData.todayKst} />
    </>
  );
}

import type { ReactElement } from "react";

import { StudyInviteArrival, createStudyInviteRawInputFromSearchParams, getKstNow, normalizeStudyInvite } from "~/features/study-invite";
import type { StudyInviteNormalization } from "~/features/study-invite";
import type { Route } from "./+types/invite-open";

interface InviteOpenLoaderData {
  normalization: StudyInviteNormalization;
}

export async function loader({ request }: Route.LoaderArgs): Promise<InviteOpenLoaderData> {
  const todayKst = getKstNow({ now: new Date() });
  const searchParams = new URL(request.url).searchParams;
  const input = createStudyInviteRawInputFromSearchParams({ searchParams });

  return { normalization: normalizeStudyInvite({ input, todayKst }) };
}

export default function InviteOpen({ loaderData }: Route.ComponentProps): ReactElement {
  return (
    <>
      <title>Campfire | 스터디 초대</title>
      <meta name="description" content="공개 스터디 초대 정보를 확인해요." />
      <StudyInviteArrival normalization={loaderData.normalization} />
    </>
  );
}

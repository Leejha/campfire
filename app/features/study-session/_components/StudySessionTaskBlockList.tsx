import type { ReactElement } from "react";

import type { SessionContentBlock } from "~/lib/notion";

import { StudySessionBlockList } from "./StudySessionBlockList";
import { getTaskDisplayBlocks } from "./taskBlockPolicy";

interface StudySessionTaskBlockListProps {
  blocks: readonly SessionContentBlock[];
}

export function StudySessionTaskBlockList({
  blocks,
}: Readonly<StudySessionTaskBlockListProps>): ReactElement {
  return <StudySessionBlockList blocks={getTaskDisplayBlocks({ blocks })} />;
}

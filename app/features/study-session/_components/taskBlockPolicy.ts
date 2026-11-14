import type { SessionContentBlock } from "~/lib/notion";

function isTaskHiddenBlock({ block }: Readonly<{ block: SessionContentBlock }>): boolean {
  return block.type === "callout" || block.type === "quote";
}

export function getTaskDisplayBlocks({
  blocks,
}: Readonly<{ blocks: readonly SessionContentBlock[] }>): SessionContentBlock[] {
  return blocks.flatMap((block) => {
    if (isTaskHiddenBlock({ block })) return [];

    return [{ ...block, children: getTaskDisplayBlocks({ blocks: block.children }) }];
  });
}

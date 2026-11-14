import assert from 'node:assert/strict';
import test from 'node:test';

import type { SessionContentBlock } from '../app/lib/notion.ts';
import { getTaskDisplayBlocks } from '../app/features/study-session/_components/taskBlockPolicy.ts';

const EMPTY_METADATA = { checked: null, language: null, url: null };
const EMPTY_ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: 'default',
};

function createContentBlock({
  children,
  id,
  type,
}: Readonly<{ children: SessionContentBlock[]; id: string; type: string }>): SessionContentBlock {
  return {
    id,
    type,
    text: id,
    richText: [{ text: id, href: null, annotations: EMPTY_ANNOTATIONS }],
    metadata: EMPTY_METADATA,
    children,
  };
}

test('hides Task callout and quote blocks with all nested content', (): void => {
  const visibleChild = createContentBlock({ children: [], id: 'visible-child', type: 'to_do' });
  const hiddenCallout = createContentBlock({
    children: [createContentBlock({ children: [], id: 'callout-child', type: 'to_do' })],
    id: 'callout',
    type: 'callout',
  });
  const hiddenQuote = createContentBlock({
    children: [createContentBlock({ children: [], id: 'quote-child', type: 'bulleted_list_item' })],
    id: 'quote',
    type: 'quote',
  });
  const visibleParent = createContentBlock({
    children: [visibleChild, hiddenQuote],
    id: 'visible-parent',
    type: 'bulleted_list_item',
  });

  const blocks = getTaskDisplayBlocks({ blocks: [hiddenCallout, visibleParent] });

  assert.deepEqual(blocks.map((block) => block.id), ['visible-parent']);
  assert.deepEqual(blocks[0]?.children.map((block) => block.id), ['visible-child']);
});

import type { ReactElement, ReactNode } from "react";
import { CheckCircle2, Circle, ExternalLink, FileQuestion } from "lucide-react";

import type { SessionContentBlock } from "~/lib/notion";
import { cn } from "~/lib/utils";

interface StudySessionBlockListProps {
  blocks: readonly SessionContentBlock[];
}

interface StudySessionBlockProps {
  block: SessionContentBlock;
}

function StudySessionRichText({ block }: Readonly<{ block: SessionContentBlock }>): ReactElement {
  if (block.richText.length === 0) return <>{block.text}</>;

  return (
    <>
      {block.richText.map((part, index) => {
        let content: ReactNode = part.text;

        if (part.annotations.code) content = <code className="rounded-r1 bg-bg-neutral-weak px-1 py-0.5 font-mono text-sm">{content}</code>;
        if (part.annotations.bold) content = <strong>{content}</strong>;
        if (part.annotations.italic) content = <em>{content}</em>;
        if (part.annotations.strikethrough) content = <s>{content}</s>;
        if (part.annotations.underline) content = <span className="underline underline-offset-4">{content}</span>;
        if (part.href) content = <a className="text-fg-brand underline underline-offset-4" href={part.href} rel="noreferrer" target="_blank">{content}</a>;

        return <span key={`${block.id}-${index}`}>{content}</span>;
      })}
    </>
  );
}

function StudySessionBlock({ block }: Readonly<StudySessionBlockProps>): ReactElement {
  const childBlocks = block.children.length > 0 ? (
    <div className="ml-5 border-l border-stroke-neutral-subtle pl-4">
      <StudySessionBlockList blocks={block.children} />
    </div>
  ) : null;

  if (block.type.startsWith("heading_")) {
    return (
      <section className="grid gap-2">
        <h4 className="font-semibold leading-6"><StudySessionRichText block={block} /></h4>
        {childBlocks}
      </section>
    );
  }

  if (block.type === "to_do") {
    const isChecked = block.metadata.checked === true;

    return (
      <div className="grid gap-2">
        <p className="flex items-start gap-2 leading-6">
          {isChecked ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-positive" />
          ) : (
            <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-neutral-muted" />
          )}
          <span className={cn(isChecked ? "text-fg-neutral-muted line-through" : "text-fg-neutral")}>
            <span className="sr-only">{isChecked ? "완료: " : "미완료: "}</span>
            <StudySessionRichText block={block} />
          </span>
        </p>
        {childBlocks}
      </div>
    );
  }

  if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
    const List = block.type === "bulleted_list_item" ? "ul" : "ol";
    const listClassName = block.type === "bulleted_list_item" ? "list-disc" : "list-decimal";

    return (
      <div className="grid gap-2">
        <List className={cn("ml-5 space-y-2 pl-1 leading-6 marker:text-fg-neutral-muted", listClassName)}>
          <li><StudySessionRichText block={block} /></li>
        </List>
        {childBlocks}
      </div>
    );
  }

  if (block.type === "quote" || block.type === "callout") {
    return (
      <aside className="grid gap-2 rounded-r2 border border-stroke-neutral-subtle bg-bg-neutral-weak p-3 text-fg-neutral-muted">
        <p className="leading-6"><StudySessionRichText block={block} /></p>
        {childBlocks}
      </aside>
    );
  }

  if (block.type === "code") {
    return (
      <pre className="overflow-x-auto rounded-r2 bg-bg-neutral-weak p-3 text-sm leading-6">
        <code>{block.text}</code>
      </pre>
    );
  }

  if (block.type === "bookmark" && block.metadata.url) {
    return (
      <p className="flex items-start gap-2 leading-6">
        <ExternalLink aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-brand" />
        <a className="text-fg-brand underline underline-offset-4" href={block.metadata.url} rel="noreferrer" target="_blank">
          <StudySessionRichText block={block} />
        </a>
      </p>
    );
  }

  if (block.type === "unsupported") {
    return (
      <p className="flex items-start gap-2 rounded-r2 bg-bg-neutral-weak p-3 text-sm leading-6 text-fg-neutral-muted">
        <FileQuestion aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {block.text || "이 노션 블록은 원본에서 확인해 주세요."}
      </p>
    );
  }

  const fallbackContent = block.metadata.url ? (
    <a className="text-fg-brand underline underline-offset-4" href={block.metadata.url} rel="noreferrer" target="_blank">
      {block.text || block.metadata.url}
    </a>
  ) : block.text || "이 노션 블록은 원본에서 확인해 주세요.";

  return (
    <div className="grid gap-2">
      <p className="leading-6">{block.text ? <StudySessionRichText block={block} /> : fallbackContent}</p>
      {block.text && block.metadata.url ? (
        <a className="flex items-center gap-2 text-sm text-fg-brand underline underline-offset-4" href={block.metadata.url} rel="noreferrer" target="_blank">
          <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
          원본 링크 보기
        </a>
      ) : null}
      {childBlocks}
    </div>
  );
}

export function StudySessionBlockList({
  blocks,
}: Readonly<StudySessionBlockListProps>): ReactElement {
  return (
    <div className="grid gap-3">
      {blocks.map((block) => (
        <StudySessionBlock key={block.id} block={block} />
      ))}
    </div>
  );
}

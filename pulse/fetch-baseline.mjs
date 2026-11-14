#!/usr/bin/env node
/**
 * 모각코 펄스 — 베이스라인 추출 스크립트
 *
 * 노션 DB(세션 날짜별 페이지, 페이지 안에 `# 이름` 섹션)를 읽어서
 *  - 세션별 참여자 목록
 *  - 주별 참여 인원 추이 (베이스라인)
 *  - 사람별 누적 참여 횟수 / 누적 완료 Task 수
 * 를 계산한다.
 *
 * 사용법:
 *   NOTION_TOKEN=secret_xxx node pulse/fetch-baseline.mjs <노션 DB 링크 또는 ID>
 *
 * 준비:
 *   1. https://www.notion.so/my-integrations 에서 통합 생성 → 토큰 발급
 *   2. 해당 DB 페이지에서 ⋯ → 연결(Connections)로 통합 초대
 *
 * 참여 판정 기준: 페이지에 `# 이름`(heading_1) 섹션이 있으면 그 사람은 참여.
 * (세션마다 참여자가 다르고, 참여한 사람만 페이지에 이름 섹션이 생기는 운영 방식)
 * 이름이 비어 있는 템플릿 슬롯만 무시한다. Task/회고 통계는 참고 지표로 함께 수집.
 */

// .env 자동 로드 (실행 위치 또는 스크립트 상위 폴더의 .env)
import fs from "node:fs";
import path from "node:path";
for (const envPath of [".env", path.join(import.meta.dirname, "..", ".env")]) {
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=["']?([^"'\n]*)["']?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
    break;
  }
}

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = "2022-06-28";
const arg = process.argv[2] || process.env.NOTION_DB;

if (!NOTION_TOKEN || !arg) {
  console.error("사용법: node pulse/fetch-baseline.mjs <DB 링크 또는 ID>");
  console.error("(NOTION_TOKEN과 NOTION_DB를 .env에 넣어두면 인자 없이 실행 가능)");
  process.exit(1);
}

// 노션 링크에서 32자리 ID 추출 (하이픈 유무 모두 허용)
function parseDatabaseId(input) {
  const m = input.replace(/-/g, "").match(/[0-9a-f]{32}/i);
  if (!m) {
    console.error("DB ID를 찾을 수 없습니다. 노션에서 DB 링크를 복사해 주세요.");
    process.exit(1);
  }
  return m[0];
}

const dbId = parseDatabaseId(arg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notion(path, options = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") || 1) * 1000;
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion API ${res.status}: ${body}`);
    }
    return res.json();
  }
  throw new Error("Notion API 재시도 초과 (429)");
}

// DB 페이지 전체 조회 (페이지네이션)
async function queryDatabase(id) {
  const pages = [];
  let cursor = undefined;
  do {
    const body = cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 };
    const data = await notion(`/databases/${id}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
    await sleep(350); // rate limit ~3rps
  } while (cursor);
  return pages;
}

// 블록 트리 재귀 조회
async function fetchBlocks(blockId, depth = 0) {
  if (depth > 4) return [];
  const blocks = [];
  let cursor = undefined;
  do {
    const qs = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const data = await notion(`/blocks/${blockId}/children${qs}`);
    for (const block of data.results) {
      if (block.has_children && block.type !== "child_page" && block.type !== "child_database") {
        await sleep(350);
        block._children = await fetchBlocks(block.id, depth + 1);
      } else {
        block._children = [];
      }
      blocks.push(block);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
    await sleep(350);
  } while (cursor);
  return blocks;
}

function plainText(block) {
  const rt = block[block.type]?.rich_text;
  if (!Array.isArray(rt)) return "";
  return rt.map((t) => t.plain_text).join("").trim();
}

function walk(blocks, fn) {
  for (const b of blocks) {
    fn(b);
    if (b._children?.length) walk(b._children, fn);
  }
}

// 페이지 블록을 `# 이름`(heading_1) 기준으로 사람 섹션으로 분리
function splitSections(blocks) {
  const sections = [];
  let current = null;
  for (const block of blocks) {
    if (block.type === "heading_1") {
      current = { name: plainText(block), blocks: [] };
      sections.push(current);
    } else if (current) {
      current.blocks.push(block);
    }
  }
  return sections;
}

// 섹션 통계: Task(to_do) 수/완료 수, 회고·목표 작성 여부
function analyzeSection(section) {
  let tasksTotal = 0;
  let tasksDone = 0;
  let hasRetro = false;
  let hasGoal = false;
  let currentH3 = "";

  const RETRO_KEYS = ["잘된", "아쉬", "다르게"];

  for (const block of section.blocks) {
    if (block.type === "heading_3") currentH3 = plainText(block);

    walk([block], (b) => {
      if (b.type === "to_do") {
        const text = plainText(b);
        if (text) {
          tasksTotal++;
          if (b.to_do.checked) tasksDone++;
        }
      }
    });

    // 회고: 잘된 것/아쉬웠던 것/다르게 해볼 것 제목 아래 내용
    if (currentH3 && RETRO_KEYS.some((k) => currentH3.includes(k))) {
      if (block.type !== "heading_3" && plainText(block)) hasRetro = true;
      walk(block._children || [], (b) => {
        if (plainText(b)) hasRetro = true;
      });
    }

    // 목표: callout(aside) 안 질문 불릿의 하위 불릿(답변) 존재 여부
    if (block.type === "callout") {
      walk(block._children || [], (b) => {
        if (b.type === "bulleted_list_item" && b._children?.some((c) => plainText(c))) {
          hasGoal = true;
        }
      });
    }
  }

  return { tasksTotal, tasksDone, hasRetro, hasGoal };
}

function pageDate(page) {
  for (const prop of Object.values(page.properties || {})) {
    if (prop.type === "date" && prop.date?.start) return prop.date.start.slice(0, 10);
  }
  return page.created_time.slice(0, 10);
}

function isoWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── 메인 ──────────────────────────────────────────────
console.log("노션 DB에서 세션 페이지를 가져오는 중...");
const pages = await queryDatabase(dbId);
console.log(`세션 페이지 ${pages.length}개 발견\n`);

const sessions = [];
for (const page of pages) {
  const date = pageDate(page);
  process.stdout.write(`  ${date} 페이지 파싱 중... `);
  const blocks = await fetchBlocks(page.id);
  const sections = splitSections(blocks);
  const participants = [];
  for (const section of sections) {
    if (!section.name) continue; // 이름 없는 빈 템플릿 슬롯
    const stats = analyzeSection(section);
    participants.push({ name: section.name, ...stats });
  }
  console.log(`참여 ${participants.length}명`);
  sessions.push({ date, participants });
}

sessions.sort((a, b) => a.date.localeCompare(b.date));

// ── 집계 ──────────────────────────────────────────────
const byPerson = new Map();
const byWeek = new Map();

for (const s of sessions) {
  const week = isoWeek(s.date);
  if (!byWeek.has(week)) byWeek.set(week, []);
  byWeek.get(week).push(s.participants.length);

  for (const p of s.participants) {
    if (!byPerson.has(p.name)) {
      byPerson.set(p.name, { sessions: 0, tasksTotal: 0, tasksDone: 0, retro: 0, goal: 0 });
    }
    const acc = byPerson.get(p.name);
    acc.sessions++;
    acc.tasksTotal += p.tasksTotal;
    acc.tasksDone += p.tasksDone;
    if (p.hasRetro) acc.retro++;
    if (p.hasGoal) acc.goal++;
  }
}

console.log("\n══════════ 세션별 참여 ══════════");
for (const s of sessions) {
  console.log(`${s.date}  ${s.participants.length}명  (${s.participants.map((p) => p.name).join(", ")})`);
}

console.log("\n══════════ 주별 참여 인원 (베이스라인) ══════════");
for (const [week, counts] of [...byWeek.entries()].sort()) {
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  console.log(`${week}  세션 ${counts.length}회, 세션당 평균 ${avg.toFixed(1)}명`);
}

console.log("\n══════════ 사람별 누적 ══════════");
console.log("이름 | 참여 세션 | 완료 Task | 전체 Task | 회고 작성 | 목표 작성");
for (const [name, a] of [...byPerson.entries()].sort((x, y) => y[1].sessions - x[1].sessions)) {
  console.log(`${name} | ${a.sessions} | ${a.tasksDone} | ${a.tasksTotal} | ${a.retro} | ${a.goal}`);
}

const totalDone = [...byPerson.values()].reduce((a, b) => a + b.tasksDone, 0);
console.log("\n══════════ 스터디 전체 누적 (대시보드 v0 후보) ══════════");
console.log(`함께한 세션: ${sessions.length}회`);
console.log(`누적 참여(연인원): ${sessions.reduce((a, s) => a + s.participants.length, 0)}명`);
console.log(`완료한 Task: ${totalDone}개`);

// 원본 데이터 저장 (대시보드에서 재사용)
const payload = { generatedAt: new Date().toISOString(), sessions };
fs.writeFileSync(path.join(import.meta.dirname, "baseline.json"), JSON.stringify(payload, null, 2));
// file:// 로 열어도 동작하도록 대시보드용 JS 래퍼도 함께 생성
fs.writeFileSync(path.join(import.meta.dirname, "baseline.js"), `window.PULSE_DATA = ${JSON.stringify(payload)};\n`);
console.log("\n상세 데이터 저장: pulse/baseline.json");

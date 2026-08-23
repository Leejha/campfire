export const PRIVATE_FOCUS_CLUES = [
  {
    id: "smallest-action",
    question: "지금 가장 작게 시작할 수 있는 행동은 무엇인가요?",
  },
  {
    id: "first-ten-minutes-step",
    question: "다음 10분에 끝낼 수 있는 첫 단계는 무엇인가요?",
  },
  {
    id: "ask-for-help",
    question: "막히는 지점을 넘기기 위해 누구에게 무엇을 물어볼까요?",
  },
] as const;

export type PrivateFocusClueId = (typeof PRIVATE_FOCUS_CLUES)[number]["id"];

export interface PrivateFocusDraft {
  clueId: PrivateFocusClueId | null;
  text: string;
}

export const EMPTY_PRIVATE_FOCUS_DRAFT: PrivateFocusDraft = {
  clueId: null,
  text: "",
};

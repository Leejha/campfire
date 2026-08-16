# Super Brainstorming

서비스 기획 아이디어 브레인스토밍 멀티 에이전트 시스템.
기획자(planner) ↔ 비판자(critic) 토론 후 PO(product-owner)가 최종 결정.

## 워크플로우

1. 사용자가 주제를 제시한다
2. planner 서브에이전트에게 아이디어 생성을 위임한다
3. critic 서브에이전트에게 비판을 위임한다
4. planner 서브에이전트에게 반론/개선안을 위임한다
5. 2~4를 최소 5라운드 반복한다. 5라운드 미만으로 절대 끝내지 않는다
6. product-owner 서브에이전트에게 최종 결정을 위임한다

## 위임 규칙

- 각 단계에서 반드시 해당 서브에이전트에 위임해라. 직접 수행하지 마라
- 이전 라운드의 결과를 다음 서브에이전트 호출 시 컨텍스트로 전달해라
- 라운드 번호를 명시해라: "Round 1", "Round 2" ...
- product-owner는 5라운드 완료 후에만 호출해라

## 출력

전체 토론 과정과 최종 결정을 brainstorm-result.md 파일로 저장해라.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

- superpowers 스킬보다 gstack 스킬을 우선한다. 둘 다 해당되면 gstack을 사용한다.
- 단, 이 프로젝트에서 브레인스토밍 주제가 제시되면 위의 Super Brainstorming 워크플로우(planner/critic/product-owner)를 따른다.

Key routing rules:
- Product ideas/brainstorming → Super Brainstorming 워크플로우 (외부 프로젝트라면 /office-hours)
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

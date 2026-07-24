# APP-157 알림 표면 재배치 설계

**목표:** 알림 드롭다운을 v5 프레임(sPg4o)에 맞춘다 — 불투명 흰 패널(surface-card) + e3 고도. 벨 위치는 APP-154에서 이미 상단바 우측 끝으로 통합돼 레코더 pill과 겹치지 않는다. 동작(배지·초대 수락/거절·해결 라벨·409 Alert·행 클릭 읽음)은 전부 유지.

**입력:** 프레임 `sPg4o`(열림)·`e71yPK`(빈)·`M5pzv`(해결), ELEVATION SPEC, 현재 `notification-bell.tsx`(+ base `ui/dropdown-menu`).

**범위 밖:** 알림 타입 확장(계약 `type`=`WORKSPACE_INVITATION` 하나), 벌크 읽음("모두 읽음으로" — 계약 엔드포인트 없음, 프레임에 있어도 그리지 않는다), 동작 변경.

## 자문자답으로 잡은 것

### 벨 위치는 154가 이미 해결했다

APP-154 상단바 1단 통합으로 벨이 우측 끝(새 노트 오른쪽)에 자리 잡았고, 레코더 B 표면(`workspace-toolbar` 녹음 pill)은 다른 노트 녹음 시에만 뜨는 fixed 중앙 pill이라 겹치지 않는다. → 위치 변경 불필요.

### 드롭다운이 캔버스색이고 그림자가 약하다 (ELEVATION drift)

실측: `DropdownMenuContent`가 base `bg-popover`(=`--el-canvas` #f5f5f5, 오프화이트) + `shadow-md` + `ring-1`을 쓴다. 프레임 sPg4o의 알림 패널은 **흰색(surface-card) + e3 2연타 그림자**로 캔버스 위에 확실히 떠 있다. ELEVATION SPEC: "알림 드롭다운은 불투명 배경(surface-card) + e3." → 알림 드롭다운에 `bg-[var(--el-surface-card)]`·`shadow-e3`·`rounded-panel`(16)·`border hairline`·`ring-0` 적용. (오버레이는 e3, 형태는 panel — 153 토큰 채택.)

### "모두 읽음으로"는 그리지 않는다

프레임 sPg4o 헤더 우측에 "모두 읽음으로"가 있으나 계약에 벌크 읽음 엔드포인트가 없다(범위 밖). 현재 코드에 없으니 유지 — 프레임 잔재를 따르지 않는다.

## 완료 조건

- [ ] 알림 드롭다운이 불투명 흰 패널 + e3 (열림·빈·해결 프레임 대조)
- [ ] 벨이 상단바 우측 끝, 레코더 pill과 안 겹침(154 계승)
- [ ] 기존 알림 테스트 전부 통과(동작 회귀 없음)
- [ ] 게이트·`codex exec review --base dev` P1 없음·Playwright 실측

## 링크
- 이슈: https://linear.app/minswon/issue/APP-157
- 근거: 프레임 sPg4o·e71yPK·M5pzv, ELEVATION SPEC

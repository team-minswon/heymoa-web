-- 통합 검증용 최소 데이터. **운영에 쓰지 않는다.**
-- 실제 전사 기록(AWS RDS)으로 검증할 때는 이 파일이 필요 없다 — 그쪽은 이미 데이터가 있다.
BEGIN;

INSERT INTO users (id, name, email, created_at, updated_at)
VALUES ('01K0000000001', '통합 테스터', 'integration@heymoa.io', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('01K0000000010', '통합 워크스페이스', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
VALUES ('01K0000000011', '01K0000000010', '01K0000000001', 'ADMIN', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, workspace_id, name, created_at, updated_at)
VALUES ('01K0000000020', '01K0000000010', '통합 프로젝트', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO notes (id, project_id, title, meeting_status, created_at, updated_at)
VALUES ('01K0000000030', '01K0000000020', '스프린트 중간 점검', 'ENDED', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO transcription_sessions (id, note_id, status, ready_expires_at, created_at, updated_at)
VALUES ('01K0000000040', '01K0000000030', 'COMPLETED', now() + interval '1 hour', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 근거 점프가 짚을 발화들. `started_at_ms` 가 web 의 정렬 축이다.
INSERT INTO transcript_segments (id, transcription_session_id, note_id, sequence, text, started_at_ms, ended_at_ms, created_at, updated_at)
VALUES
  ('01K0000000101','01K0000000040','01K0000000030', 1, '스테이징 이관 결과부터 짚고 그다음 경로 검색 인덱스로 넘어가겠습니다.',  242000,  250000, now(), now()),
  ('01K0000000102','01K0000000040','01K0000000030', 2, '인덱스를 줄이면 조회 손해가 얼마나 되나요?',                           620000,  626000, now(), now()),
  ('01K0000000103','01K0000000040','01K0000000030', 3, '측정해 보니 15% 안쪽이었습니다.',                                    1640000, 1646000, now(), now()),
  ('01K0000000104','01K0000000040','01K0000000030', 4, '그럼 경로 데이터 저장소는 MongoDB로 갑시다.',                        1872000, 1878000, now(), now()),
  ('01K0000000105','01K0000000040','01K0000000030', 5, '장애 대응 runbook이 비어 있는 것도 따로 봐야 합니다.',               2480000, 2486000, now(), now())
ON CONFLICT (id) DO NOTHING;

COMMIT;

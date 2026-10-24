import { compareLabels } from "@/lib/transcription/speaker-identity";
import type { TranscriptPresentationSegment } from "@/lib/transcription/presentation";
import { personAvatarKey } from "@/lib/people/avatar-key";
import { speakerAvatarName } from "@/lib/transcription/speaker-identity";

/** 화자 띠에서 발화로 가는 길. 띠를 눌렀나(strip) · 이전/다음 버튼인가(step). */
export type SpeakerJumpVia = "strip" | "step";

/** 화자 하나가 말한 분량. 저장하지 않고 화면이 그릴 때 센다. */
export type SpeakerStat = {
  /**
   * 묶는 열쇠. 사람에게 붙었으면 `participantId`, 아니면 `label:A`.
   *
   * **사람이 열쇠다.** 한 사람이 라벨 둘을 갖는 일이 실제로 있고(목소리는 갈렸고 사람은
   * 하나다), 라벨로 묶으면 같은 이름이 두 줄로 나와 합이 100%를 넘는 것처럼 읽힌다.
   */
  key: string;
  name: string;
  /**
   * 얼굴을 그릴 열쇠. `PersonAvatar` 의 `name` 으로 그대로 넘긴다.
   *
   * **[key] 로 대신 그리면 안 된다.** [key] 는 이 회의 안의 참여 기록이고 얼굴 열쇠는
   * 워크스페이스에서 안 변하는 `guestId`·`userId` 다 — 임시 참여자는 회의마다 참여
   * 기록이 새로 생겨서, [key] 로 그리면 같은 사람이 전사·참석자 목록과 다른 얼굴로 섰다.
   */
  avatarName: string;
  /** 계정 참여자의 프로필 사진. 없으면 구슬을 그린다. */
  image: string | null;
  /** 이 줄의 발화들이 속한 라벨 전부. 순번 순이다. */
  labels: string[];
  /**
   * 이 사람이 **가진** 라벨. 둘 이상이면 목소리가 갈렸다는 뜻이다.
   *
   * [labels] 와 다르다 — 발화 하나만 이 사람에게 돌린 줄은 그 라벨 *안에* 섞인 것이지
   * 그 라벨을 가진 것이 아니다. **구슬 색이 이 값에서 나온다**: 소유가 아닌 것을 색의
   * 근거로 삼으면 전사의 칩과 패널이 같은 사람에게 다른 색을 준다.
   */
  ownedLabels: string[];
  speakingMs: number;
  segmentCount: number;
  /** 라벨 있는 발화 전체 대비 비중. 0~1. */
  share: number;
  /**
   * **언제** 말했나. 회의 전체를 [TIMELINE_BINS] 칸으로 나눈 0~1 값이다.
   *
   * 자기 줄의 가장 바쁜 칸을 1로 잡는다 — 얼마나는 옆의 비중 막대가 이미 말하고, 이 띠가
   * 맡은 것은 모양이다. 전체 최대로 맞추면 조용한 사람의 띠가 통째로 납작해져 「언제
   * 말했나」가 안 보인다.
   */
  timeline: number[];
  /** 아직 아무도 안 붙인 화자. 이 줄이 곧 붙이러 가는 자리다. */
  unassigned: boolean;
  /** 가장 이른 발화. 「여기로 가기」가 이것을 쓴다. */
  firstSegmentId: string | null;
  /** 그 발화의 회의 축 좌표. 타임라인 칸에서 되짚으면 칸 하나만큼 틀린다. */
  firstStartedAtMs: number | null;
  /**
   * 이 줄의 **모든** 발화(시간순). 띠를 그리고, 띠를 눌러 고르고, 도크가 지금 누가 말하는지
   * 가르는 데 이 목록 하나를 쓴다 — 그리는 것과 가는 곳이 갈리면 막대를 눌러 엉뚱한 데로 간다.
   */
  utterances: SpeakerUtterance[];
  /**
   * 이전·다음 버튼이 차례로 도는 발화(시간순, [utterances] 의 부분집합). **맞장구를 건너뛴다** —
   * 「네」 한 마디는 누구인지 알아보는 데 쓸모가 없다(APP-1163). 짧은 발화뿐인 사람은 전부 대상이다.
   * 띠에는 이 규칙을 쓰지 않는다 — 실제 말한 자리는 짧아도 다 보여야 한다.
   */
  stepTargets: SpeakerUtterance[];
};

/** 발화 하나의 회의 축 구간. */
export type SpeakerUtterance = {
  segmentId: string;
  startedAtMs: number;
  endedAtMs: number;
};

/** 이보다 짧은 발화는 이전·다음 버튼이 건너뛴다 — 누구인지 알아보는 단서로 안 친다. */
export const MIN_STEP_SEGMENT_MS = 1500;

/**
 * 말한 칸의 최소 높이(0~1). 긴 회의에서 칸 하나는 1분 남짓이라, 그 칸에 1초 「네.」 하나뿐이면
 * 가장 바쁜 칸 대비 2% 남짓으로 말 없는 칸과 구분이 안 됐다. 말한 칸은 적어도 이만큼 선다.
 */
export const TIMELINE_MIN_VISIBLE = 0.25;

type SpeakerInput = {
  label: string;
  assignedParticipantId?: string | null;
  assignedName?: string | null;
  confirmed?: boolean;
};

/**
 * 타임라인 칸 수. 한 시간짜리 회의에서 칸 하나가 1분 남짓이라 「앞부분에만 말했다」가
 * 보이면서도 패널 폭(약 150px)에 2px 막대로 들어간다.
 */
export const TIMELINE_BINS = 48;

type ParticipantInput = {
  participantId: string;
  /** 워크스페이스에서 안 변하는 열쇠. 얼굴은 이것으로 그린다 — `personAvatarKey` 가 정한다. */
  userId?: string | null;
  guestId?: string | null;
  name: string;
  image?: string | null;
};

/**
 * 화자별 말한 분량. **세그먼트에서 직접 센다.**
 *
 * 계약의 `diarization.speakers[].speakingMs` 를 안 쓰는 이유가 둘이다. 그 값은 라벨 단위라
 * **발화 단위 지정**(`assignedParticipantId`)을 반영하지 못하고, 지정이 바뀌어도 서버를 다시
 * 물어야 갱신된다. 세그먼트에서 세면 지정이 바뀌는 순간 같은 상태에서 다시 계산된다.
 *
 * **라벨 없는 발화는 분모에서 뺀다.** 그 시간이 누구 것인지 모르는데 분모에 넣으면 모든
 * 사람의 비중이 조금씩 낮게 나오고, 합이 100%가 안 되는 이유를 화면이 설명하지 못한다.
 *
 * **참여자는 한 마디도 안 했어도 줄을 갖는다.** 회의에 앉아 듣기만 한 사람이 실제로 있고,
 * 말한 사람만 세면 그 사람은 목록에서 사라져 「이 회의에 없던 사람」으로 읽힌다.
 */
export function summarizeSpeakers({
  segments,
  speakers,
  participants = [],
  durationMs,
}: {
  segments: TranscriptPresentationSegment[];
  speakers: SpeakerInput[];
  participants?: ParticipantInput[];
  /** 녹음 길이. 타임라인 축의 끝이다 — 없으면 마지막 발화로 대신한다. */
  durationMs?: number;
}): SpeakerStat[] {
  const byLabel = new Map(speakers.map((speaker) => [speaker.label, speaker]));
  const personOf = new Map(
    participants.map((participant) => [participant.participantId, participant])
  );
  /**
   * 사람 → 그 사람이 **가진** 라벨. **발화가 아니라 화자 지정이 정한다** — A·B 를 가진
   * 사람의 A 발화를 전부 남에게 개별 지정하면 그 사람의 줄에는 A 가 한 번도 안 들어오고,
   * 소유가 [B] 로 줄어 전사의 칩과 색이 갈린다.
   */
  const ownedLabelsOf = new Map<string, string[]>();
  for (const speaker of speakers) {
    const participantId = speaker.assignedParticipantId;
    if (!participantId) continue;
    ownedLabelsOf.set(participantId, [
      ...(ownedLabelsOf.get(participantId) ?? []),
      speaker.label,
    ]);
  }

  /**
   * 줄 → 얼굴 열쇠. **줄을 묶는 열쇠와 다르다.** 묶기는 이 회의의 `participantId` 로
   * 해야 하고(임시 참여자 둘이 이름만 같아도 갈라야 한다), 얼굴은 워크스페이스에서
   * 안 변하는 값으로 그려야 전사·참석자 목록과 같은 사람이 같은 얼굴로 선다.
   */
  const hashKeyOf = new Map<string, string>();
  const rows = new Map<string, SpeakerStat>();
  const firstStartedAtMs = new Map<string, number>();
  const spoken = new Map<string, SpeakerUtterance[]>();
  /**
   * 칸의 기준은 **회의 전체**다. 사람마다 제 발화 구간을 나누면 누구나 꽉 찬 띠가 된다.
   *
   * **녹음 길이가 축이다.** 마지막 발화로 끝을 삼으면 그 뒤의 침묵이 축에서 잘려, 10분
   * 녹음에서 앞 1분만 말한 사람의 띠가 48칸을 꽉 채운다 — 머리글이 말하는 회의 길이와
   * 다른 회의를 그리게 된다. 없을 때만 마지막 발화로 대신한다.
   */
  const meetingMs = Math.max(
    durationMs ?? 0,
    segments.reduce((end, segment) => Math.max(end, segment.endedAtMs), 0)
  );
  const binMs = meetingMs / TIMELINE_BINS;

  for (const segment of segments) {
    const label = segment.speakerLabel;
    if (!label) continue;

    const speaker = byLabel.get(label);
    // 발화 단위 지정이 라벨의 지정을 이긴다 — 더 좁은 범위를 사람이 나중에 골랐다.
    const participantId =
      segment.assignedParticipantId ?? speaker?.assignedParticipantId ?? null;
    const person = participantId ? personOf.get(participantId) : undefined;
    const key = participantId ? participantId : `label:${label}`;
    // 참여자 목록에 없는 사람은 `participantId` 로 떨어진다 — 그 값밖에 아는 게 없다.
    hashKeyOf.set(
      key,
      participantId ? personAvatarKey(person ?? { participantId }) : key
    );

    const row =
      rows.get(key) ??
      ({
        key,
        avatarName: "",
        name: participantId
          ? (person?.name ?? "이름 없는 참여자")
          : `화자 ${label}`,
        image: person?.image ?? null,
        labels: [],
        ownedLabels: participantId
          ? [...(ownedLabelsOf.get(participantId) ?? [])]
          : [],
        speakingMs: 0,
        segmentCount: 0,
        share: 0,
        timeline: Array<number>(TIMELINE_BINS).fill(0),
        unassigned: !participantId,
        firstSegmentId: null,
        firstStartedAtMs: null,
        utterances: [],
        stepTargets: [],
      } satisfies SpeakerStat);

    if (!row.labels.includes(label)) row.labels.push(label);
    row.speakingMs += Math.max(0, segment.endedAtMs - segment.startedAtMs);
    row.segmentCount += 1;
    const list = spoken.get(key) ?? [];
    list.push({
      segmentId: segment.segmentId,
      startedAtMs: segment.startedAtMs,
      endedAtMs: segment.endedAtMs,
    });
    spoken.set(key, list);
    // 첫 발화는 **회의 축에서 가장 이른 것**이다. 세그먼트 배열의 순서를 믿지 않는다 —
    // 실시간 전사와 저장본이 섞여 들어오는 자리라 도착 순서가 시간 순서가 아니다.
    const first = firstStartedAtMs.get(key);
    if (first === undefined || segment.startedAtMs < first) {
      firstStartedAtMs.set(key, segment.startedAtMs);
      row.firstSegmentId = segment.segmentId;
      row.firstStartedAtMs = segment.startedAtMs;
    }
    rows.set(key, row);
  }

  for (const participant of participants) {
    if (rows.has(participant.participantId)) continue;
    hashKeyOf.set(participant.participantId, personAvatarKey(participant));
    rows.set(participant.participantId, {
      key: participant.participantId,
      avatarName: "",
      name: participant.name,
      image: participant.image ?? null,
      labels: [],
      ownedLabels: [...(ownedLabelsOf.get(participant.participantId) ?? [])],
      speakingMs: 0,
      segmentCount: 0,
      share: 0,
      timeline: Array<number>(TIMELINE_BINS).fill(0),
      unassigned: false,
      firstSegmentId: null,
      firstStartedAtMs: null,
      utterances: [],
      stepTargets: [],
    });
  }

  const total = [...rows.values()].reduce(
    (sum, row) => sum + row.speakingMs,
    0
  );
  for (const row of rows.values()) {
    row.labels.sort(compareLabels);
    row.ownedLabels.sort(compareLabels);
    // 시간순. 배열 순서를 믿지 않는다(실시간 전사와 저장본이 섞여 도착 순서가 시간 순서가 아니다).
    const all = [...(spoken.get(row.key) ?? [])].sort(
      (a, b) => a.startedAtMs - b.startedAtMs
    );
    const meaningful = all.filter(
      (item) => item.endedAtMs - item.startedAtMs >= MIN_STEP_SEGMENT_MS
    );
    row.utterances = all;
    row.stepTargets = meaningful.length > 0 ? meaningful : all;
    // **띠는 모든 발화로 그린다.** 맞장구도 실제로 말한 자리다 — 이동 대상만 그리면 1초짜리
    // 「네.」가 띠에서 사라져 그 사람이 거기서 말한 적이 없는 것처럼 읽힌다.
    // **칸을 넘는 발화는 걸친 만큼 나눠 담는다.** 시작 칸에 다 몰면 긴 발언이 봉우리 하나가
    // 되어, 5분을 쉬지 않고 말한 사람과 그 자리에서 한마디 한 사람이 같은 모양이 된다.
    const spokenBins = new Set<number>();
    for (const item of binMs > 0 ? all : []) {
      const firstBin = Math.min(
        TIMELINE_BINS - 1,
        Math.floor(item.startedAtMs / binMs)
      );
      const lastBin = Math.min(
        TIMELINE_BINS - 1,
        Math.floor(Math.max(item.startedAtMs, item.endedAtMs) / binMs)
      );
      // 시작 칸은 길이가 0이어도 말한 칸이다.
      spokenBins.add(firstBin);
      for (let bin = firstBin; bin <= lastBin; bin += 1) {
        const overlap =
          Math.min(item.endedAtMs, (bin + 1) * binMs) -
          Math.max(item.startedAtMs, bin * binMs);
        if (overlap > 0) spokenBins.add(bin);
        row.timeline[bin] += Math.max(0, overlap);
      }
    }
    row.share = total > 0 ? row.speakingMs / total : 0;
    // **라벨을 정렬한 뒤다.** `speakerAvatarName` 이 「가장 이른 라벨」을 쓰는데,
    // 정렬 전에 부르면 도착 순서가 얼굴을 정해 새로고침마다 색이 튄다.
    row.avatarName = speakerAvatarName(row.ownedLabels, {
      label: row.unassigned ? row.labels[0] : null,
      hashKey: hashKeyOf.get(row.key) ?? row.key,
    });
    const peak = Math.max(...row.timeline);
    row.timeline = row.timeline.map((ms, bin) =>
      spokenBins.has(bin)
        ? Math.max(TIMELINE_MIN_VISIBLE, peak > 0 ? ms / peak : 0)
        : 0
    );
  }

  // 0초인 사람이 여럿이면 이름으로 가른다 — 안 그러면 목록을 열 때마다 순서가 흔들린다.
  return [...rows.values()].sort(
    (a, b) => b.speakingMs - a.speakingMs || a.name.localeCompare(b.name, "ko")
  );
}

/**
 * 띠를 누른 시각([atMs])이 가리키는 발화의 인덱스. **그 시각을 품은 발화**가 먼저고,
 * 없으면 앞뒤로 가장 가까운 발화다. 발화가 없으면 -1. 보통 [SpeakerStat.utterances] 를 넘긴다.
 *
 * 「그 시각 이후 첫 발화」로 고르면 안 된다 — 막대는 발화가 걸친 칸에 서므로, 긴 발언 한가운데를
 * 누르면 그 발언은 이미 시작한 뒤라 건너뛰고 몇 분 뒤 다음 발화로 간다(APP-1429).
 */
export function jumpIndexAt(
  utterances: Pick<SpeakerUtterance, "startedAtMs" | "endedAtMs">[],
  atMs: number
) {
  let best = -1;
  let bestGap = Infinity;
  utterances.forEach(({ startedAtMs: start, endedAtMs }, index) => {
    const end = Math.max(start, endedAtMs);
    const gap = atMs < start ? start - atMs : atMs > end ? atMs - end : 0;
    if (gap < bestGap) {
      best = index;
      bestGap = gap;
    }
  });
  return best;
}

/** `12분 30초` — 분량은 초까지만 보면 된다. */
export function formatSpeakingTime(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

import { personAvatarKey } from "@/components/heymoa/person-avatar";
import type { DiarizationSpeaker } from "@/lib/transcription/presentation";

/**
 * `A`→0, `B`→1 … `Z`→25, `AA`→26. 서버의 라벨 생성(`SpeakerLabel`)과 정확히 뒤집는 짝이다.
 *
 * **순번으로 배정해야 색이 갈린다.** 예전에는 이름을 해싱했는데, 다섯 색에 화자 넷이면
 * 생일 문제로 겹치기 쉽고 실제로 이웃한 두 화자가 같은 계열로 나왔다.
 *
 * @returns 글자 라벨이 아니면 `null`. 업체가 모르는 모양을 줬을 때다
 */
function indexOfLabel(label: string) {
  if (!/^[A-Z]+$/.test(label)) return null;
  let index = 0;
  for (const character of label) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index - 1;
}

/**
 * 라벨을 **순번 순**으로 세운다. 기본 `sort()` 는 글자 순이라 `["AA","B"]` 를 그대로 두는데,
 * 서버의 라벨 생성 순서로는 `B` 가 먼저다. 색을 「가장 이른 라벨」에서 가져오는 곳이 둘이라
 * (전사의 칩과 화자 패널) 둘이 다른 규칙을 쓰면 같은 사람이 두 색으로 선다.
 */
export function compareLabels(a: string, b: string) {
  const left = indexOfLabel(a);
  const right = indexOfLabel(b);
  // 글자 라벨이 아니면 순번이 없다. 뒤로 보내고 저희끼리는 글자 순이다
  if (left === null || right === null) return a.localeCompare(b);
  return left - right;
}

/**
 * 얼굴 열쇠를 정하는 **하나뿐인 규칙.**
 *
 * 전사의 칩과 화자 패널이 둘 다 이것을 부른다 — 규칙을 두 벌로 두면 같은 사람이 두 화면에서
 * 다른 얼굴로 서고, 실제로 두 번 그랬다.
 *
 * 1. 가진 라벨이 있으면 **가장 이른 라벨**. 라벨 둘을 맡아도 얼굴 하나다
 * 2. 아직 아무도 안 붙은 화자는 제 라벨
 * 3. 라벨을 안 가진 사람(발화 하나만 돌려받았거나 한 마디도 안 했다)은 제 식별자
 *
 * @param ownedLabels 이 사람이 **가진** 라벨. 발화 하나만 얹힌 라벨은 가진 것이 아니다
 * @param fallback `label` 은 아직 아무도 안 붙은 화자의 라벨, `hashKey` 는 마지막 수단
 */
export function speakerAvatarName(
  ownedLabels: readonly string[],
  fallback: { label?: string | null; hashKey: string }
) {
  // 누구인지 알면 **그 사람의 얼굴**이다. 라벨을 섞으면 안 된다 — 같은 사람이 전사에서는
  // 이 얼굴, 참석자 목록에서는 저 얼굴로 서게 된다.
  if (ownedLabels.length) return fallback.hashKey;
  // 아직 누구인지 모르는 화자. **라벨만으로는 안 된다** — 라벨은 회의마다 다시 쓰여서,
  // 다른 회의의 화자 A 가 같은 얼굴로 서면 서로 다른 두 사람이 한 얼굴이 된다.
  if (fallback.label) return `label:${fallback.label}`;
  return fallback.hashKey;
}

export type SpeakerIdentity = {
  /** 화면에 쓸 이름. 연결 안 됐으면 `화자 A`. */
  displayName: string;
  /**
   * 얼굴을 그릴 열쇠. `PersonAvatar` 의 `name` 으로 넘긴다 — 같은 열쇠면 같은 얼굴이다.
   *
   * **글자를 얹지 않는다.** 이름이 늘 옆에 있어 글자가 가려 주는 것이 없다.
   */
  avatarName: string;
  /** 계정이 연결됐으면 사진 URL. */
  imageUrl: string | null;
  /** 아직 아무도 안 본 화자. 점을 찍어 이름을 붙일 이유를 만든다. */
  unassigned: boolean;
};

export type SpeakerIdentitySource = DiarizationSpeaker & {
  assignedParticipantId?: string | null;
  confirmed?: boolean;
  image?: string | null;
};

/**
 * 얼굴을 들고 있는 쪽. **계약의 `speakers[]` 에는 사진이 없다** — 붙은 사람의 식별자만 준다.
 * 사진은 같은 응답의 참석자 목록에 있고, 그 둘을 여기서 잇는다.
 *
 * **잇는 열쇠가 `participantId`다** (APP-491). 계정으로 이으면 계정 없는 임시 참여자는
 * 그 값이 없어 전부 한 칸에 뭉치고, 남의 사진이 실릴 수 있다.
 */
export type SpeakerFace = {
  participantId: string;
  /** 워크스페이스에서 안 변하는 열쇠. 없으면 `participantId` 로 떨어진다. */
  userId?: string | null;
  guestId?: string | null;
  /** 발화 단위 지정이 이 이름을 쓴다 — 그 줄에는 라벨의 이름 대신 이 사람이 선다. */
  name?: string | null;
  image?: string | null;
};

/**
 * 화자에게 얼굴을 준다. **아무것도 저장하지 않는다** — 렌더 시점에 계산한다.
 *
 * 저장하면 팔레트를 바꿀 때 옛 회의만 옛 색으로 남고, 화자 수가 팔레트보다 많으면 어차피
 * 겹치므로 안정성을 약속할 수도 없다.
 *
 * **색은 사람이 정한다. 그 사람의 가장 이른 라벨로.**
 *
 * V31 부터 한 사람이 여러 화자를 맡을 수 있다. 예전에는 라벨마다 색을 줬고 「목소리 덩어리의
 * 표시」라고 적어 뒀는데, 화면에서는 **이름도 얼굴도 같은 두 줄이 다른 색으로** 섰다 —
 * 보는 사람은 목소리 덩어리를 보는 것이 아니라 사람을 보고 있어서, 그냥 「왜 색이 두 개지」가
 * 된다. 이동준 멘토님이 라벨 D·E 를 함께 가진 실제 회의에서 그게 드러났다.
 *
 * 사람의 색을 **가장 이른 라벨**에서 가져오면 순번 배정의 「열까지 안 겹친다」를 그대로
 * 쓰면서 사람 하나가 색 하나를 갖는다. 아직 아무도 안 붙은 화자는 제 라벨 색 그대로다 —
 * 이름을 붙여도 그 사람의 첫 라벨이 곧 그 라벨이라 색이 안 튄다.
 *
 * 발화 단위 지정도 같다. 그 줄은 이름·사진과 함께 **색도** 그 사람 것이 된다.
 */
export function createSpeakerIdentityResolver(
  speakers: SpeakerIdentitySource[],
  participants: SpeakerFace[] = []
) {
  const byLabel = new Map(speakers.map((speaker) => [speaker.label, speaker]));
  /** 사람 → 그 사람이 **가진** 라벨. 색은 [speakerOrb] 이 이것으로 정한다. */
  const ownedLabelsOf = new Map<string, string[]>();
  for (const speaker of speakers) {
    const participantId = speaker.assignedParticipantId;
    if (!participantId) continue;
    ownedLabelsOf.set(participantId, [
      ...(ownedLabelsOf.get(participantId) ?? []),
      speaker.label,
    ]);
  }
  /** 사람 → 얼굴 열쇠. 참석자 목록·설정과 **같은 함수**로 만든다. */
  const keyOf = new Map(
    participants.map((participant) => [
      participant.participantId,
      personAvatarKey(participant),
    ])
  );
  const faceOf = new Map(
    participants.map((participant) => [
      participant.participantId,
      participant.image ?? null,
    ])
  );
  const nameOf = new Map(
    participants.map((participant) => [
      participant.participantId,
      participant.name ?? null,
    ])
  );

  return (
    label: string | null | undefined,
    /**
     * 이 발화에만 붙은 참여 기록. 있으면 **라벨의 이름을 이긴다** — 더 좁은 범위를 사람이
     * 나중에 골랐다는 뜻이라서다.
     *
     * 목록에 없는 참여 기록이면 무시하고 라벨을 따른다. 참석자에서 빠진 사람이 전사에
     * 이름만 남는 것보다, 라벨의 답으로 돌아가는 편이 덜 틀린다.
     */
    overriddenParticipantId?: string | null
  ): SpeakerIdentity | null => {
    if (!label) return null;
    const overriddenName = overriddenParticipantId
      ? (nameOf.get(overriddenParticipantId) ?? null)
      : null;
    if (overriddenName) {
      return {
        displayName: overriddenName,
        // 이름도 얼굴도 이 사람 것이다 — 얼굴만 라벨에 남으면 같은 사람이 둘로 보인다.
        avatarName: speakerAvatarName(
          ownedLabelsOf.get(overriddenParticipantId!) ?? [],
          {
            hashKey:
              keyOf.get(overriddenParticipantId!) ?? overriddenParticipantId!,
          }
        ),
        imageUrl: faceOf.get(overriddenParticipantId!) ?? null,
        // 사람이 이 줄을 콕 집어 골랐다. 「아직 아무도 안 본 화자」가 아니다
        unassigned: false,
      };
    }
    const speaker = byLabel.get(label);
    const name = speaker?.assignedName ?? null;
    // 「참석자 아님」으로 확정한 화자도 `화자 A` 로 남는다. 그 사람이 누구인지 우리가
    // 모른다는 것이 사실이고, 다른 말로 꾸미면 거짓이 된다.
    const displayName = name ?? `화자 ${label}`;

    return {
      displayName,
      avatarName: speaker?.assignedParticipantId
        ? speakerAvatarName(
            ownedLabelsOf.get(speaker.assignedParticipantId) ?? [],
            {
              hashKey:
                keyOf.get(speaker.assignedParticipantId) ??
                speaker.assignedParticipantId,
            }
          )
        : speakerAvatarName([], { label, hashKey: label }),
      // **사람이면 사진이 먼저다.** 고를 때 얼굴로 알아본 사람이 붙는 순간 글자로 바뀌면
      // 같은 사람인지 다시 확인하게 된다. 파스텔은 사진이 없을 때의 대체일 뿐이다
      imageUrl:
        speaker?.image ??
        (speaker?.assignedParticipantId
          ? (faceOf.get(speaker.assignedParticipantId) ?? null)
          : null),
      unassigned: !speaker?.confirmed,
    };
  };
}

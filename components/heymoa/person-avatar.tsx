"use client";

import Avatar from "boring-avatars";

import { cn } from "@/lib/utils";

/**
 * 사람 하나의 얼굴. **사진이 없으면 식별자로 그린다.**
 *
 * 예전에는 파스텔 열 개에서 골랐는데, 열 자리에 다섯 명을 해싱하면 겹칠 확률이 70%다 —
 * 목 데이터에서 실제로 둘이 같은 색이었고 그건 자리를 늘리지 않는 한 안 풀린다. 색상각으로
 * 옮겨 자리를 360 으로 늘려도 각이 가까운 둘은 같은 색으로 보인다.
 *
 * **색이 아니라 모양으로 가른다.** `boring-avatars` 의 `beam` 은 같은 색이 나와도 눈·입과
 * 얼굴의 기울기가 달라 옆에 두면 바로 갈린다 — 20px 칩에서도 그렇다.
 *
 * **[name] 이 곧 그 사람이다.** 전사의 칩·화자 패널·참석자·설정이 같은 열쇠를 넘겨야 한
 * 사람이 네 화면에서 같은 얼굴로 선다. 무엇을 열쇠로 삼는지는 `speakerAvatarName` 이 정한다.
 */

/**
 * 얼굴이 쓰는 색. `globals.css` 의 파스텔 다섯을 **푼 값**이다 — `boring-avatars` 가 SVG
 * 안에서 색을 섞어야 해서 `var()` 를 못 받는다.
 *
 * 다섯이지만 팔레트가 다섯이라는 뜻은 아니다. `beam` 은 이 다섯에서 배경·얼굴·눈·입을
 * 따로 골라 섞고 기울기까지 흔들어서, 조합이 수천 가지다.
 */
const PALETTE = ["#7ed0c0", "#f2b7a0", "#a8c8f0", "#c9b6ee", "#f3aebd"];

/**
 * 그 사람의 얼굴 열쇠. **워크스페이스에서 변하지 않는 식별자가 먼저다** — 계정과 임시
 * 참여자 식별자는 회의를 옮겨도 같아서, 같은 사람이 전사·참석자·설정에서 한 얼굴로 선다.
 * `participantId` 는 한 회의 안에서만 뜻이 있어 회의마다 얼굴이 튀므로 마지막 수단이다.
 *
 * **이름을 먼저 쓰면 안 된다** — 한 워크스페이스에 박도현·박순영이 같이 있고, 개명하면
 * 얼굴이 튄다.
 */
export function personAvatarKey(person: {
  participantId?: string | null;
  userId?: string | null;
  guestId?: string | null;
  email?: string | null;
  name?: string | null;
}) {
  return (
    person.guestId ||
    person.userId ||
    person.participantId ||
    person.email ||
    person.name ||
    "?"
  );
}

export function PersonAvatar({
  name,
  image,
  size = 20,
  className,
}: {
  /** 그 사람을 가리키는 변하지 않는 열쇠. 이름이 아니라 식별자다. */
  name: string;
  /** 계정 사진. 있으면 **사진이 먼저다** — 얼굴로 알아본 사람이 그림으로 바뀌면 안 된다. */
  image?: string | null;
  size?: number;
  className?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        // **`data-slot="avatar"` 를 단다.** `AvatarGroup` 이 그 값으로 겹친 얼굴에 흰 테를
        // 두르는데(`*:data-[slot=avatar]:ring-2`), 없으면 스택에서 얼굴끼리 그냥 겹친다.
        data-slot="avatar"
        style={{ width: size, height: size }}
        className={cn(
          "block shrink-0 rounded-full object-cover",
          className
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      data-slot="avatar"
      style={{ width: size, height: size }}
      /**
       * **`block` 이어야 한다.** 기본 `inline` 상자에는 `width`·`height` 가 아예 안 먹고
       * `overflow` 도 무시된다 — 글자 줄에 얹힌 채 SVG 만 제 크기로 서서, 둥근 모서리가
       * 안 잘리고 위아래 여백이 글꼴에 따라 달라진다. 원이 찌그러져 보이던 자리다.
       */
      className={cn(
        "block shrink-0 overflow-hidden rounded-full leading-none",
        className
      )}
    >
      {/**
        * SVG 를 상자에 꽉 채운다. **`!` 가 필요하다.**
        *
        * 버튼·배지·콤보박스 트리거가 아이콘 크기를 맞추려고
        * `[&_svg:not([class*='size-'])]:size-4` 같은 규칙을 갖고 있다. `boring-avatars` 가
        * 그리는 `<svg>` 에는 클래스가 없어서 그 `:not()` 을 통과해 **16px 로 눌린다** —
        * 상자는 20px 원 그대로라 그림이 4px 작아지고, 남는 테두리가 「원이 파먹힌 자국」으로
        * 보인다. 전사의 화자 칩이 정확히 그 자리였다(다른 화면은 그런 조상이 없어 멀쩡했다).
        *
        * 선택자 특정도가 같아 순서 싸움이 되므로 중요도로 못박는다.
        */}
      <span className="block size-full [&>svg]:block [&>svg]:size-full!">
        <Avatar name={name} variant="beam" size={size} colors={PALETTE} />
      </span>
    </span>
  );
}

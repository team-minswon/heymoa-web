"use client";

import Avatar from "boring-avatars";

import { cn } from "@/lib/utils";

const PALETTE = ["#7ed0c0", "#f2b7a0", "#a8c8f0", "#c9b6ee", "#f3aebd"];

export { personAvatarKey, unnamedSpeakerAvatarKey } from "@/lib/people/avatar-key";

export function PersonAvatar({
  name,
  image,
  size = 20,
  alt = "",
  className,
}: {
  name: string;
  image?: string | null;
  size?: number;
  alt?: string;
  className?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={alt}
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
      className={cn(
        "block shrink-0 overflow-hidden rounded-full leading-none",
        className
      )}
    >
      <span className="block size-full [&>svg]:block [&>svg]:size-full!">
        <Avatar name={name} variant="beam" size={size} colors={PALETTE} />
      </span>
    </span>
  );
}

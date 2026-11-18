import Image from "next/image";

/** Decorative: the creator's name is always shown beside it. */
export function CreatorAvatar({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl: string | null;
  size: number;
}) {
  if (!avatarUrl) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-line font-semibold text-ink"
        style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.45)) }}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    <Image
      src={avatarUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
    />
  );
}

import Image from "next/image";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type CustomerAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

export function CustomerAvatar({ name, photoUrl, size = "md" }: CustomerAvatarProps) {
  const sizeClass = size === "sm" ? "size-9 text-xs" : size === "lg" ? "size-20 text-xl" : "size-12 text-sm";

  return (
    <div
      className={`grid ${sizeClass} shrink-0 place-items-center overflow-hidden rounded-full border border-[#dfcbc7] bg-[#f7e9e6] font-semibold text-[#7a4b56]`}
      aria-label={`${name} Avatar`}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={`${name} Foto`}
          width={80}
          height={80}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{getInitials(name) || "?"}</span>
      )}
    </div>
  );
}

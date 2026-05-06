type ProfileActionTileProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function ProfileActionTile({ icon, label, onClick, disabled }: ProfileActionTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-12 min-w-12 items-center justify-center rounded-full border border-[#dbe6e2] bg-white text-[#1d4d47] shadow-[0_2px_8px_rgba(15,90,85,0.08)] transition hover:border-[#bed6cd] hover:bg-[#f6fbf9] disabled:cursor-not-allowed disabled:opacity-50"
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

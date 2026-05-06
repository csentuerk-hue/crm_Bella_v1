import { ProfileActionTile } from "@/components/customers/profile-action-tile";

type ActionItem = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type CustomerActionDockProps = {
  actions: ActionItem[];
};

export function CustomerActionDock({ actions }: CustomerActionDockProps) {
  return (
    <div className="mt-4 rounded-2xl border border-[#deebe6] bg-white/85 p-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {actions.map((action) => (
          <ProfileActionTile
            key={action.label}
            icon={action.icon}
            label={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
          />
        ))}
      </div>
    </div>
  );
}

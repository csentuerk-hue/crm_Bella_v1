type InlineNoticeProps = {
  type: "error" | "success" | "info";
  text: string;
};

export function InlineNotice({ type, text }: InlineNoticeProps) {
  const className =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <p className={`rounded-xl border px-3 py-2 text-sm ${className}`}>
      {text}
    </p>
  );
}

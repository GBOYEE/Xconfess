interface Props {
  id?: string;
  label: string;
  count: number;
  active: boolean;
}

export const ReactionTooltip = ({ id, label, count, active }: Props) => {
  const text = active ? `${label}, ${count}, You` : `${label}, ${count}`;

  return (
    <div
      id={id}
      role="tooltip"
      aria-label={text}
      tabIndex={0}
      className="absolute bottom-full mb-2 rounded-md bg-black px-3 py-1 text-xs text-white shadow-lg focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
    >
      {label} • {count}
      {active && <span className="ml-1 text-pink-400">(You)</span>}
    </div>
  );
};

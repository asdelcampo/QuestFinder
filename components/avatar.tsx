// People are the pins (DESIGN.md §6.1). There are no profile photos, so each person gets a
// monogram in a white ring, colored from their id so it stays the same everywhere.
const COLORS = ["#0039ff", "#5155e8", "#c81e0a", "#07805a", "#c2410c", "#a21caf", "#0060d1"];

function colorFor(id: string) {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return COLORS[sum % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

const SIZES = { sm: "size-8 text-xs", md: "size-10 text-sm", xl: "size-24 text-3xl" };

export function Avatar({ id, name, size = "md" }: { id: string; name: string; size?: keyof typeof SIZES }) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-[3px] border-white font-bold text-white shadow-md ${SIZES[size]}`}
      style={{ backgroundColor: colorFor(id) }}
    >
      {initials(name)}
    </span>
  );
}

// Overlapping faces with a black count chip hanging off the end, like Bump's cluster pills
export function AvatarCluster({ people, emoji }: { people: { id: string; name: string }[]; emoji: string }) {
  const shown = people.slice(0, 4);
  return (
    <div className="flex items-center">
      <div className="flex -space-x-3">
        {shown.map((person) => (
          <Avatar key={person.id} id={person.id} name={person.name} size="sm" />
        ))}
      </div>
      <span className="-ml-2 inline-flex items-center gap-1 rounded-full border-2 border-white bg-ink px-2 py-0.5 text-xs font-bold text-white">
        <span aria-hidden>{emoji}</span>
        {people.length}
      </span>
    </div>
  );
}

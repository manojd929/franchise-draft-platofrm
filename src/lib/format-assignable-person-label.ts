import type { AssignablePerson } from "@/types/assignable-person";

/** Single-line label for picks / selects (never shows raw UUID). */
export function formatAssignablePersonLabel(person: AssignablePerson): string {
  const name = person.displayName?.trim();
  if (name) {
    return `${name} (${person.email})`;
  }
  return person.email;
}

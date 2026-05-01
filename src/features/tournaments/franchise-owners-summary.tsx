import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAssignablePersonLabel } from "@/lib/format-assignable-person-label";
import type { AssignablePerson } from "@/types/assignable-person";

interface FranchiseOwnersSummaryProps {
  assignablePeople: AssignablePerson[];
  teams: Array<{ id: string; name: string; ownerUserId: string | null }>;
}

export function FranchiseOwnersSummary({
  assignablePeople,
  teams,
}: FranchiseOwnersSummaryProps) {
  const teamsByOwner = new Map<string, string[]>();
  for (const team of teams) {
    if (!team.ownerUserId) continue;
    const list = teamsByOwner.get(team.ownerUserId) ?? [];
    list.push(team.name);
    teamsByOwner.set(team.ownerUserId, list);
  }
  for (const [, names] of teamsByOwner) {
    names.sort((a, b) => a.localeCompare(b));
  }

  return (
    <section
      className="rounded-xl border border-border/70 bg-card/40 p-6 backdrop-blur-md"
      aria-labelledby="franchise-owners-summary-heading"
    >
      <h3
        id="franchise-owners-summary-heading"
        className="text-lg font-semibold tracking-tight"
      >
        Franchise owners (this league)
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Franchise owner logins only — league admin accounts that run the auction never appear here.
        You as commissioner are excluded too (use another login if you also draft). “Team” shows
        which franchise each owner has now. Remove an owner from the Teams table when you need to
        free their login for someone else.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-border/60 bg-background/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Owner</TableHead>
              <TableHead>Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignablePeople.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  No eligible franchise owners yet. Create an owner login above, then assign them
                  when you add or edit a team.
                </TableCell>
              </TableRow>
            ) : (
              assignablePeople.map((person) => {
                const franchiseNames = teamsByOwner.get(person.id);
                return (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      {formatAssignablePersonLabel(person)}
                    </TableCell>
                    <TableCell className="max-w-[min(28rem,65vw)] text-sm text-muted-foreground">
                      {franchiseNames?.length
                        ? franchiseNames.join(", ")
                        : "Not assigned yet"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

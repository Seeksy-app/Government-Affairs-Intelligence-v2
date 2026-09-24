import { useState } from "react";
import { Link } from "wouter";
import { FolderOpen, Plus, Tag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TrackedBill } from "@shared/schema";
import { useBillActions } from "./use-bill-actions";

// "+" on a bill card: assign to a client, a research project, or tags.
export function BillOrganizeMenu({ bill, onAddTags }: { bill: TrackedBill; onAddTags: () => void }) {
  const [open, setOpen] = useState(false);
  const { portals, matters, isShared, toggleClient, setMatter } = useBillActions(bill, { loadAssignments: open });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Organize: assign to client, research project, or tags"
          title="Assign to client, research project, or tags"
          onClick={(e) => e.stopPropagation()}
          data-testid={`button-organize-${bill.id}`}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Organize</DropdownMenuLabel>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Users className="w-4 h-4 mr-2" /> Assign to client
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            {portals.length === 0 ? (
              <DropdownMenuItem asChild>
                <Link href="/portals">Set up a client portal…</Link>
              </DropdownMenuItem>
            ) : (
              portals.map((portal) => (
                <DropdownMenuCheckboxItem
                  key={portal.id}
                  checked={isShared(portal.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleClient(portal)}
                >
                  {portal.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderOpen className="w-4 h-4 mr-2" /> Research project
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuRadioGroup
              value={bill.matterId ?? "none"}
              onValueChange={(value) => setMatter(value === "none" ? null : value)}
            >
              <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
              {matters.map((matter) => (
                <DropdownMenuRadioItem key={matter.id} value={matter.id}>
                  {matter.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/matters">Manage research projects…</Link>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onSelect={onAddTags}>
          <Tag className="w-4 h-4 mr-2" /> Add tags…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { peopleService } from "@/services";
import type { Person } from "@niftygifty/types";

interface PeopleCellProps {
  id?: string;
  selectedIds: number[];
  people: Person[];
  onChange: (ids: number[]) => void;
  onPersonCreated?: (person: Person) => void;
  placeholder?: string;
  className?: string;
}

export function PeopleCell({
  id,
  selectedIds,
  people,
  onChange,
  onPersonCreated,
  placeholder = "Select...",
  className,
}: PeopleCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedPeople = people.filter((p) => selectedIds.includes(p.id));

  const filteredPeople = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = people.some(
    (p) => p.name.toLowerCase() === search.toLowerCase()
  );

  const togglePerson = (personId: number) => {
    if (selectedIds.includes(personId)) {
      onChange(selectedIds.filter((id) => id !== personId));
    } else {
      onChange([...selectedIds, personId]);
    }
  };

  const removePerson = (e: React.MouseEvent, personId: number) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== personId));
  };

  const createPerson = async () => {
    if (!search.trim() || creating) return;
    setCreating(true);
    try {
      const newPerson = await peopleService.create({ name: search.trim() });
      onPersonCreated?.(newPerson);
      onChange([...selectedIds, newPerson.id]);
      setSearch("");
    } catch (err) {
      console.error("Failed to create person:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-[28px] py-1 px-2 font-normal hover:bg-muted/50",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedPeople.length > 0 ? (
              selectedPeople.map((person) => (
                <Badge
                  key={person.id}
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {person.name}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-1 hover:text-destructive cursor-pointer"
                    onClick={(e) => removePerson(e, person.id)}
                    onKeyDown={(e) => e.key === "Enter" && removePerson(e as unknown as React.MouseEvent, person.id)}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              {filteredPeople.map((person) => (
                <CommandItem
                  key={person.id}
                  value={person.name}
                  onSelect={() => togglePerson(person.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedIds.includes(person.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {person.name}
                </CommandItem>
              ))}
              {search.trim() && !exactMatch && (
                <CommandItem
                  onSelect={createPerson}
                  className="text-violet-400"
                  disabled={creating}
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create &quot;{search.trim()}&quot;
                </CommandItem>
              )}
              {filteredPeople.length === 0 && !search.trim() && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Type a name to create
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


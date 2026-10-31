"use client";

import { useState } from "react";
import Link from "next/link";
import type { Person } from "@niftygifty/types";
import { useWorkspace } from "@/contexts/workspace-context";
import { relationshipCategoriesFor } from "@/lib/relationship-categories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, UserPlus, Plus, Trash2, ChevronRight } from "lucide-react";

interface PeopleSectionProps {
  people: Person[];
  onAddPerson: (name: string, relationship?: string) => Promise<void>;
  onDeletePerson: (person: Person) => Promise<void>;
}

function groupByRelationship(people: Person[]): Record<string, Person[]> {
  return people.reduce(
    (acc, person) => {
      const rel = person.relationship || "other";
      if (!acc[rel]) acc[rel] = [];
      acc[rel].push(person);
      return acc;
    },
    {} as Record<string, Person[]>
  );
}

function QuickAddForm({
  onAdd,
}: {
  onAdd: (name: string, relationship?: string) => Promise<void>;
}) {
  const { currentWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsAdding(true);
    try {
      await onAdd(name.trim(), relationship || undefined);
      setName("");
      setRelationship("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm mb-4">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Person's name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
            />
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger className="w-[160px] bg-slate-800/50 border-slate-700 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {relationshipCategoriesFor(currentWorkspace?.workspace_type).map((cat) => (
                  <SelectItem
                    key={cat}
                    value={cat}
                    className="text-slate-200 focus:bg-slate-800 focus:text-white capitalize"
                  >
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem
                  value="other"
                  className="text-slate-200 focus:bg-slate-800 focus:text-white"
                >
                  Other
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={!name.trim() || isAdding}
            className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? "Adding..." : "Add Person"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PersonChip({
  person,
  onDelete,
}: {
  person: Person;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-sm text-slate-300 hover:border-violet-500/50 hover:bg-slate-800 transition-colors">
      <Link
        href={`/people/${person.id}`}
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        {person.name}
        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-violet-400" />
      </Link>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function PeopleList({
  people,
  onDelete,
}: {
  people: Person[];
  onDelete: (person: Person) => void;
}) {
  const grouped = groupByRelationship(people);

  if (people.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No people added yet</p>
        <p className="text-sm">Add someone above to start your gift list</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([relationship, groupPeople]) => (
        <div key={relationship}>
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 capitalize">
            {relationship}
          </h4>
          <div className="flex flex-wrap gap-2">
            {groupPeople.map((person) => (
              <PersonChip
                key={person.id}
                person={person}
                onDelete={() => onDelete(person)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PeopleSection({
  people,
  onAddPerson,
  onDeletePerson,
}: PeopleSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="h-5 w-5 text-fuchsia-400" />
        <h2 className="text-xl font-semibold text-white">Add People to Gift</h2>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        Build your gift list by adding people you want to buy for.
      </p>

      <QuickAddForm onAdd={onAddPerson} />
      <PeopleList people={people} onDelete={onDeletePerson} />
    </section>
  );
}


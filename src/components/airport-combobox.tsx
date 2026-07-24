import { useState, useMemo } from "react";
import { Check, ChevronDown, Plane } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AIRPORTS, airportLabel, type Airport } from "@/lib/airports";

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

export function AirportCombobox({ label, value, onChange, placeholder = "בחר נמל...", className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(() => {
    const m = value.match(/\(([A-Z]{3})\)/);
    const code = m?.[1] ?? value.trim().toUpperCase();
    return AIRPORTS.find((a) => a.iata === code);
  }, [value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between text-right font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <Plane className="h-3.5 w-3.5 text-muted-foreground" />
              {selected ? (
                <span className="truncate">
                  <span className="font-mono text-xs font-semibold">{selected.iata}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-sm">{selected.city}, {selected.country}</span>
                </span>
              ) : value ? (
                <span className="truncate text-sm">{value}</span>
              ) : (
                <span className="text-muted-foreground text-sm">{placeholder}</span>
              )}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="חיפוש לפי קוד, עיר או מדינה..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>לא נמצאו נמלים</CommandEmpty>
              <CommandGroup>
                {(() => {
                  const s = search.trim().toLowerCase();
                  const filtered: Airport[] = s
                    ? AIRPORTS.filter((a) =>
                        `${a.iata} ${a.icao} ${a.city} ${a.country} ${a.name}`
                          .toLowerCase()
                          .includes(s)
                      )
                    : AIRPORTS;
                  const limited = filtered.slice(0, 100);
                  return (
                    <>
                      {limited.map((a) => {
                        const isSelected = selected?.iata === a.iata;
                        return (
                          <CommandItem
                            key={a.iata}
                            value={a.iata}
                            onSelect={() => {
                              onChange(airportLabel(a));
                              setOpen(false);
                              setSearch("");
                            }}
                            className="flex items-center gap-2"
                          >
                            <Check className={cn("h-3.5 w-3.5", isSelected ? "opacity-100" : "opacity-0")} />
                            <span className="font-mono text-xs font-semibold w-10">{a.iata}</span>
                            <span className="flex-1 text-sm truncate">
                              {a.city}, {a.country}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{a.name}</span>
                          </CommandItem>
                        );
                      })}
                      {filtered.length > limited.length && (
                        <div className="px-3 py-2 text-[11px] text-muted-foreground text-center">
                          מציג {limited.length} מתוך {filtered.length} — המשך להקליד לצמצום התוצאות
                        </div>
                      )}
                    </>
                  );
                })()}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

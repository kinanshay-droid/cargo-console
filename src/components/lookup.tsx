import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Loader2, Plus, Star, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { LOOKUP_LABELS, type LookupType } from "@/lib/lookup-types";
import {
  createLookupItem,
  getLookupItemsByIds,
  listLookupItems,
  type LookupItem,
} from "@/lib/lookups.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

type LookupProps = {
  type: LookupType;
  /** The selected item's id, or (with matchBy="code") its code. */
  value: string | null;
  onChange: (item: LookupItem | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  /** Show inactive rows too, by default. Off by default (matches most forms). */
  showInactiveByDefault?: boolean;
  /**
   * Most existing columns in this app store a lookup's plain `code` (TEXT),
   * not its `id` (UUID) — they predate the lookup tables. Set matchBy="code"
   * for those; onChange always hands back the full item either way, so the
   * caller picks item.id or item.code when writing it back to form state.
   */
  matchBy?: "id" | "code";
};

const PAGE_SIZE = 40;
const RECENT_KEY = (type: string) => `lookup_recent_${type}`;
const FAVORITES_KEY = (type: string) => `lookup_fav_${type}`;

function readIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* ignore storage errors (private mode, quota, ...) */
  }
}

function deriveCode(input: string): string {
  const latin = input.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12);
  return latin || `ITEM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Generic master-data picker. Backed by the lookup_<type> tables created in
 * the stage-2 migration — one component covers all 27 domains (airports,
 * countries, currencies, incoterms, ...). Search runs server-side (debounced),
 * results page in lazily as the list is scrolled, favorites and "recently
 * used" are remembered per-browser in localStorage, and org admins can
 * "quick add" a value that doesn't exist yet.
 */
export function Lookup({
  type,
  value,
  onChange,
  label,
  placeholder,
  className,
  showInactiveByDefault = false,
  matchBy = "id",
}: LookupProps) {
  const { isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();

  const listFn = useServerFn(listLookupItems);
  const getByIdsFn = useServerFn(getLookupItemsByIds);
  const createFn = useServerFn(createLookupItem);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(!showInactiveByDefault);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFavorites(new Set(readIds(FAVORITES_KEY(type))));
    setRecentIds(readIds(RECENT_KEY(type)));
  }, [type]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [debouncedSearch, activeOnly]);

  const listQuery = useQuery({
    queryKey: ["lookup-list", type, debouncedSearch, activeOnly, limit],
    queryFn: () => listFn({ data: { type, search: debouncedSearch, activeOnly, limit, offset: 0 } }),
    enabled: open,
    staleTime: 30_000,
  });

  const selectedQuery = useQuery({
    queryKey: ["lookup-item", type, value, matchBy],
    queryFn: () => getByIdsFn({ data: { type, ids: value ? [value] : [], by: matchBy } }),
    enabled: !!value,
    staleTime: 60_000,
  });
  const selected = selectedQuery.data?.[0] ?? null;

  const pinnedIds = useMemo(
    () => Array.from(new Set([...favorites, ...recentIds])),
    [favorites, recentIds],
  );
  const pinnedQuery = useQuery({
    queryKey: ["lookup-pinned", type, pinnedIds],
    queryFn: () => getByIdsFn({ data: { type, ids: pinnedIds } }),
    enabled: open && !debouncedSearch && pinnedIds.length > 0,
    staleTime: 30_000,
  });
  const pinnedById = useMemo(() => {
    const m = new Map<string, LookupItem>();
    for (const it of pinnedQuery.data ?? []) m.set(it.id, it);
    return m;
  }, [pinnedQuery.data]);
  const favoriteItems = useMemo(
    () => [...favorites].map((id) => pinnedById.get(id)).filter((v): v is LookupItem => !!v),
    [favorites, pinnedById],
  );
  const recentItems = useMemo(
    () =>
      recentIds
        .map((id) => pinnedById.get(id))
        .filter((v): v is LookupItem => !!v && !favorites.has(v.id)),
    [recentIds, pinnedById, favorites],
  );

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const hasExactMatch = useMemo(() => {
    if (!debouncedSearch) return true;
    const s = debouncedSearch.toLowerCase();
    return items.some((it) => it.name.toLowerCase() === s || it.code.toLowerCase() === s);
  }, [items, debouncedSearch]);

  function persistFavorites(next: Set<string>) {
    setFavorites(next);
    writeIds(FAVORITES_KEY(type), [...next]);
  }

  function isSelected(item: LookupItem): boolean {
    if (!value) return false;
    return matchBy === "code" ? value === item.code : value === item.id;
  }

  function toggleFavorite(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistFavorites(next);
  }

  function rememberRecent(id: string) {
    const next = [id, ...recentIds.filter((r) => r !== id)].slice(0, 8);
    setRecentIds(next);
    writeIds(RECENT_KEY(type), next);
  }

  function selectItem(item: LookupItem) {
    rememberRecent(item.id);
    onChange(item);
    setOpen(false);
    setSearch("");
  }

  function handleScroll() {
    const el = listRef.current;
    if (!el || listQuery.isFetching) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom && items.length < total) setLimit((l) => l + PAGE_SIZE);
  }

  async function handleQuickAdd() {
    if (!search.trim() || creating) return;
    setCreating(true);
    try {
      const item = await createFn({
        data: { type, code: deriveCode(search), name: search.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: ["lookup-list", type] });
      selectItem(item);
    } catch (err) {
      console.error("Quick add failed", err);
    } finally {
      setCreating(false);
    }
  }

  const domainLabel = LOOKUP_LABELS[type];

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
              {selected ? (
                <span className="truncate">
                  <span className="font-mono text-xs font-semibold">{selected.code}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-sm">{selected.name}</span>
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">
                  {placeholder ?? `בחר ${domainLabel}...`}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1">
              {selected && (
                <X
                  className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                />
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`חיפוש ${domainLabel}...`}
              value={search}
              onValueChange={setSearch}
            />
            <div className="flex items-center gap-2 border-b px-3 py-1.5">
              <Checkbox
                id={`${type}-active-only`}
                checked={activeOnly}
                onCheckedChange={(v) => setActiveOnly(v === true)}
              />
              <label htmlFor={`${type}-active-only`} className="text-xs text-muted-foreground cursor-pointer">
                פעילים בלבד
              </label>
            </div>
            <CommandList ref={listRef} onScroll={handleScroll}>
              {listQuery.isLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  טוען...
                </div>
              )}
              {!listQuery.isLoading && items.length === 0 && !favoriteItems.length && !recentItems.length && (
                <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
              )}

              {!debouncedSearch && favoriteItems.length > 0 && (
                <>
                  <CommandGroup heading="מועדפים">
                    {favoriteItems.map((item) => (
                      <LookupRow
                        key={item.id}
                        item={item}
                        selected={isSelected(item)}
                        isFavorite
                        onSelect={selectItem}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {!debouncedSearch && recentItems.length > 0 && (
                <>
                  <CommandGroup heading="נעשה בו שימוש לאחרונה">
                    {recentItems.map((item) => (
                      <LookupRow
                        key={item.id}
                        item={item}
                        selected={isSelected(item)}
                        isFavorite={favorites.has(item.id)}
                        onSelect={selectItem}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {items.length > 0 && (
                <CommandGroup heading={debouncedSearch ? "תוצאות חיפוש" : "הכל"}>
                  {items.map((item) => (
                    <LookupRow
                      key={item.id}
                      item={item}
                      selected={isSelected(item)}
                      isFavorite={favorites.has(item.id)}
                      onSelect={selectItem}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </CommandGroup>
              )}

              {listQuery.isFetching && !listQuery.isLoading && (
                <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  טוען עוד...
                </div>
              )}

              {isAdmin && debouncedSearch && !hasExactMatch && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value="__quick_add__"
                      disabled={creating}
                      onSelect={handleQuickAdd}
                      className="flex items-center gap-2 text-primary"
                    >
                      {creating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      <span className="text-sm">הוסף "{search.trim()}" כ{domainLabel} חדש/ה</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
            {total > 0 && (
              <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground text-center">
                מציג {items.length} מתוך {total}
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function LookupRow({
  item,
  selected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  item: LookupItem;
  selected: boolean;
  isFavorite: boolean;
  onSelect: (item: LookupItem) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <CommandItem value={item.id} onSelect={() => onSelect(item)} className="flex items-center gap-2">
      <Check className={cn("h-3.5 w-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      <span className="font-mono text-xs font-semibold w-14 shrink-0 truncate">{item.code}</span>
      <span className="flex-1 truncate text-sm">{item.name}</span>
      {item.organization_id && (
        <span className="shrink-0 text-[10px] text-muted-foreground">ארגוני</span>
      )}
      {!item.is_active && (
        <span className="shrink-0 text-[10px] text-muted-foreground">לא פעיל</span>
      )}
      <button
        type="button"
        onClick={(e) => onToggleFavorite(item.id, e)}
        className="shrink-0 text-muted-foreground hover:text-amber-500"
        aria-label={isFavorite ? "הסר ממועדפים" : "הוסף למועדפים"}
      >
        <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-amber-400 text-amber-400")} />
      </button>
    </CommandItem>
  );
}

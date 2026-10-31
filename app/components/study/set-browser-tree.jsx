import { SetEditMenu } from "@/components/study/study-edit-controls";
import * as React from "react";
import { StarFillIcon } from "@primer/octicons-react";

import { StudyResetControl } from "@/components/study/study-reset-control";
import { StudySetDeleteControl } from "@/components/study/study-set-delete-control";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getFavoriteItemKey,
  normalizeFavoriteItems,
} from "@/lib/study-favorites";
import { getSetCategoryPath, getSetNavigationTree } from "@/lib/study-sets";
import { cn } from "@/lib/utils";

const nestedConnectorBaseClass =
  "before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:rounded-full before:bg-border/70 before:content-['']";
const nestedConnectorClass = `${nestedConnectorBaseClass} before:w-2`;
const nestedLeafConnectorClass = `${nestedConnectorBaseClass} before:w-3.5`;
const markerSlotClass =
  "flex size-6 shrink-0 items-center justify-center self-center";
const treeItemRowClass =
  "relative -mx-2 flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5";

function getSetAriaLabel(set) {
  const categoryPath = getSetCategoryPath(set);

  return categoryPath ? `${set.title}. ${categoryPath}` : set.title;
}

function DefaultMarker({ variant, isActive }) {
  return (
    <span aria-hidden="true" className={markerSlotClass}>
      <span
        data-corner-shape={variant === "set" ? "round" : undefined}
        className={cn(
          "size-2 shrink-0 border border-border/70",
          variant === "category" ? "rounded-sm bg-muted/30" : "rounded-full",
          variant === "set" &&
            (isActive ? "border-primary/30 bg-primary" : "bg-background"),
        )}
      />
    </span>
  );
}

function FavoriteMarker({
  isFavorited,
  variant,
  isActive,
  itemLabel,
  ariaLabel,
  confirmOpen,
  onConfirmOpenChange,
  onFavorite,
  onUnfavorite,
  showDefaultMarker = true,
  className,
}) {
  if (!isFavorited) {
    const defaultMarker = showDefaultMarker ? (
      <DefaultMarker variant={variant} isActive={isActive} />
    ) : null;

    if (!defaultMarker || !onFavorite) {
      return defaultMarker;
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={ariaLabel}
        onClick={onFavorite}
        className={cn(
          markerSlotClass,
          "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        {defaultMarker}
      </Button>
    );
  }

  const markerClassName = cn(markerSlotClass, "text-foreground", className);

  if (!onUnfavorite) {
    return (
      <span aria-hidden="true" className={markerClassName}>
        <StarFillIcon className="size-3.5 fill-current" />
      </span>
    );
  }

  function handleUnfavorite() {
    onUnfavorite();
    onConfirmOpenChange(false);
  }

  return (
    <Popover open={confirmOpen} onOpenChange={onConfirmOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={ariaLabel}
            className={cn(markerClassName, "hover:text-foreground")}
          >
            <StarFillIcon className="size-3.5 fill-current" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-fit min-w-0 gap-3">
        <PopoverHeader>
          <PopoverTitle>Unfavorite this {itemLabel}?</PopoverTitle>
          <PopoverDescription className="text-body-sm">
            Remove it from the start screen.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onConfirmOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUnfavorite}>Unfavorite</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FavoriteContextMenu({
  itemLabel,
  isFavorited,
  onFavorite,
  onRequestUnfavorite,
  children,
}) {
  const [unfavoriteRequested, setUnfavoriteRequested] = React.useState(false);
  // A finalFocus callback overrides focus that already moved into another popup.
  // Keep native restoration unless handing off to the confirmation.
  const finalFocus = unfavoriteRequested ? false : undefined;
  const canFavorite = !isFavorited && typeof onFavorite === "function";
  const canUnfavorite =
    isFavorited && typeof onRequestUnfavorite === "function";

  if (!canFavorite && !canUnfavorite) {
    return children;
  }

  function handleClick() {
    if (isFavorited) {
      setUnfavoriteRequested(true);
      return;
    }

    onFavorite();
  }

  function handleOpenChange(open) {
    if (open) {
      setUnfavoriteRequested(false);
    }
  }

  function handleOpenChangeComplete(open) {
    if (!open && unfavoriteRequested) {
      onRequestUnfavorite();
    }
  }

  return (
    <ContextMenu
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <ContextMenuTrigger render={children} />
      <ContextMenuContent
        finalFocus={finalFocus}
        className="w-fit min-w-0 max-w-64"
      >
        <ContextMenuItem onClick={handleClick}>
          <span>
            {isFavorited ? "Unfavorite" : "Favorite"} {itemLabel}
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SetLeafNode({
  node,
  depth,
  activeSlug,
  onSelect,
  canReset,
  onResetSet,
  canDelete,
  onDeleteSet,
  favoriteKeys,
  onFavoriteItem,
  onUnfavoriteItem,
}) {
  const isActive = node.set.slug === activeSlug;
  const isNestedLeaf = depth > 0;
  const favoriteItem = { type: "set", slug: node.set.slug };
  const isFavorited = favoriteKeys.has(getFavoriteItemKey(favoriteItem));
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  function handleFavorite() {
    onFavoriteItem?.(favoriteItem);
  }

  function handleUnfavorite() {
    onUnfavoriteItem?.(favoriteItem);
  }

  const favoriteMarker = (
    <FavoriteMarker
      isFavorited={isFavorited}
      variant="set"
      isActive={isActive}
      itemLabel="study set"
      ariaLabel={`${isFavorited ? "Unfavorite" : "Favorite"} ${node.set.title}`}
      confirmOpen={confirmOpen}
      onConfirmOpenChange={setConfirmOpen}
      onFavorite={onFavoriteItem ? handleFavorite : undefined}
      onUnfavorite={onUnfavoriteItem ? handleUnfavorite : undefined}
      showDefaultMarker={!isNestedLeaf}
    />
  );

  const row = (
    <div
      className={cn(
        "relative -mx-2 flex min-w-0 items-center px-2",
        !isNestedLeaf && "gap-1.5",
        "group/set-row text-foreground",
        isNestedLeaf && nestedLeafConnectorClass,
      )}
    >
      {!isNestedLeaf ? favoriteMarker : null}
      <div
        className={cn(
          "flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-xl py-1 pr-2 transition-colors",
          isNestedLeaf
            ? cn("ml-1.5", isFavorited ? "pl-1.5" : "pl-3")
            : "pl-3.5",
          isActive ? "bg-accent" : "group-hover/set-row:bg-muted",
        )}
      >
        {isNestedLeaf ? favoriteMarker : null}
        <button
          type="button"
          onClick={() => onSelect(node.set.slug)}
          aria-current={isActive ? "page" : undefined}
          aria-label={getSetAriaLabel(node.set)}
          className="flex min-w-0 flex-1 flex-col items-start rounded-lg py-0.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {node.categoryPathLabel ? (
            <span className="block max-w-full truncate text-body-sm text-muted-foreground">
              {node.categoryPathLabel}
            </span>
          ) : null}
          <span
            className={cn(
              "block max-w-full truncate text-foreground",
              isActive ? "text-label-lg" : "text-body-md",
            )}
          >
            {node.set.title}
          </span>
        </button>
        {canDelete || canReset ? (
          <div className="flex shrink-0 items-center gap-0.5 self-center">
            <SetEditMenu set={node.set} />
            {canDelete ? (
              <StudySetDeleteControl
                set={node.set}
                onDelete={() => onDeleteSet(node.set.slug)}
              />
            ) : null}
            <StudyResetControl
              visible={canReset}
              onReset={() => onResetSet(node.set.slug)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <FavoriteContextMenu
      itemLabel="study set"
      isFavorited={isFavorited}
      onFavorite={onFavoriteItem ? handleFavorite : undefined}
      onRequestUnfavorite={
        onUnfavoriteItem ? () => setConfirmOpen(true) : undefined
      }
    >
      {row}
    </FavoriteContextMenu>
  );
}

function CategoryNode({
  node,
  depth,
  activeSlug,
  onSelect,
  resettableSetSlugs,
  onResetSet,
  deletableSetSlugs,
  onDeleteSet,
  favoriteKeys,
  onFavoriteItem,
  onUnfavoriteItem,
}) {
  const favoriteItem = { type: "category", path: node.path };
  const isFavorited = favoriteKeys.has(getFavoriteItemKey(favoriteItem));
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  function handleFavorite() {
    onFavoriteItem?.(favoriteItem);
  }

  function handleUnfavorite() {
    onUnfavoriteItem?.(favoriteItem);
  }

  const row = (
    <div
      className={cn(
        treeItemRowClass,
        "text-label-md text-muted-foreground",
        depth > 0 && nestedConnectorClass,
      )}
    >
      <FavoriteMarker
        isFavorited={isFavorited}
        variant="category"
        itemLabel="category"
        ariaLabel={`${isFavorited ? "Unfavorite" : "Favorite"} ${node.name}`}
        confirmOpen={confirmOpen}
        onConfirmOpenChange={setConfirmOpen}
        onFavorite={onFavoriteItem ? handleFavorite : undefined}
        onUnfavorite={onUnfavoriteItem ? handleUnfavorite : undefined}
      />
      <span className="block min-w-0 flex-1 truncate">{node.name}</span>
    </div>
  );

  return (
    <div className="min-w-0">
      <FavoriteContextMenu
        itemLabel="category"
        isFavorited={isFavorited}
        onFavorite={onFavoriteItem ? handleFavorite : undefined}
        onRequestUnfavorite={
          onUnfavoriteItem ? () => setConfirmOpen(true) : undefined
        }
      >
        {row}
      </FavoriteContextMenu>

      <TreeBranch
        nodes={node.children}
        depth={depth + 1}
        activeSlug={activeSlug}
        onSelect={onSelect}
        resettableSetSlugs={resettableSetSlugs}
        onResetSet={onResetSet}
        deletableSetSlugs={deletableSetSlugs}
        onDeleteSet={onDeleteSet}
        favoriteKeys={favoriteKeys}
        onFavoriteItem={onFavoriteItem}
        onUnfavoriteItem={onUnfavoriteItem}
      />
    </div>
  );
}

function TreeBranch({
  nodes,
  depth,
  activeSlug,
  onSelect,
  resettableSetSlugs,
  onResetSet,
  deletableSetSlugs,
  onDeleteSet,
  favoriteKeys,
  onFavoriteItem,
  onUnfavoriteItem,
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        depth > 0 && "ml-[10px] border-l border-border/70 pl-2",
      )}
    >
      {nodes.map((node) =>
        node.type === "category" ? (
          <CategoryNode
            key={node.key}
            node={node}
            depth={depth}
            activeSlug={activeSlug}
            onSelect={onSelect}
            resettableSetSlugs={resettableSetSlugs}
            onResetSet={onResetSet}
            deletableSetSlugs={deletableSetSlugs}
            onDeleteSet={onDeleteSet}
            favoriteKeys={favoriteKeys}
            onFavoriteItem={onFavoriteItem}
            onUnfavoriteItem={onUnfavoriteItem}
          />
        ) : (
          <SetLeafNode
            key={node.key}
            node={node}
            depth={depth}
            activeSlug={activeSlug}
            onSelect={onSelect}
            canReset={resettableSetSlugs.has(node.set.slug)}
            onResetSet={onResetSet}
            canDelete={deletableSetSlugs.has(node.set.slug)}
            onDeleteSet={onDeleteSet}
            favoriteKeys={favoriteKeys}
            onFavoriteItem={onFavoriteItem}
            onUnfavoriteItem={onUnfavoriteItem}
          />
        ),
      )}
    </div>
  );
}

export function SetBrowserTree({
  sets,
  nodes,
  activeSlug,
  onSelect,
  resettableSetSlugs = new Set(),
  onResetSet,
  deletableSetSlugs = new Set(),
  onDeleteSet,
  favoriteItems = [],
  onFavoriteItem,
  onUnfavoriteItem,
  className,
}) {
  const tree = nodes ?? getSetNavigationTree(sets);
  const favoriteKeys = React.useMemo(
    () =>
      new Set(
        normalizeFavoriteItems(favoriteItems)
          .map(getFavoriteItemKey)
          .filter(Boolean),
      ),
    [favoriteItems],
  );

  if (!tree.length) {
    return null;
  }

  return (
    <div className={cn("min-w-0", className)}>
      <TreeBranch
        nodes={tree}
        depth={0}
        activeSlug={activeSlug}
        onSelect={onSelect}
        resettableSetSlugs={resettableSetSlugs}
        onResetSet={onResetSet}
        deletableSetSlugs={deletableSetSlugs}
        onDeleteSet={onDeleteSet}
        favoriteKeys={favoriteKeys}
        onFavoriteItem={onFavoriteItem}
        onUnfavoriteItem={onUnfavoriteItem}
      />
    </div>
  );
}

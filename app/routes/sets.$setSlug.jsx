import { ButtonLink } from "@/components/button-link";
import * as React from "react";
import { Navigate, useLoaderData, useRevalidator } from "react-router";

import { StudyAppHeader } from "@/components/study/study-app-header";
import { Button } from "@/components/ui/button";
import { StudyShell } from "@/components/study/study-shell";
import { StudyCard } from "@/components/study/study-card";
import { StudySetEndCap } from "@/components/study/study-set-end-cap";
import {
  getOrderedStudyCards,
  getQuestionOrder,
  isShuffleEnabled,
  useStudyReaderStore,
} from "@/stores/use-study-reader-store";
import { formatPageTitle } from "@/lib/app-config";
import { listStudySetRecords } from "@/lib/runtime-study-set-storage";
import { activateStudyPacksFromUrl } from "@/lib/study-pack-activation";
import { selectFirstLocalSet, selectLocalSetBySlug } from "@/lib/study-sets";
import {
  useHydrateStudySetsStore,
  useStudySetsStore,
} from "@/stores/use-study-sets-store";

export function meta({ data }) {
  return [
    {
      title: formatPageTitle(data?.setTitle),
    },
  ];
}

export async function clientLoader({ params, request }) {
  let records;
  let storageError = null;
  try {
    activateStudyPacksFromUrl(request.url);
    records = await listStudySetRecords({ requiredSlug: params.setSlug });
  } catch {
    records = useStudySetsStore.getState().records;
    storageError = "Study set could not be loaded.";
  }
  const localSet = selectLocalSetBySlug(records, params.setSlug);
  const set = localSet;
  if (set) {
    useStudyReaderStore.getState().ensureQuestionOrder(set.slug, set.cards);
  }
  return {
    records,
    setSlug: params.setSlug,
    setTitle: set?.title,
    storageError,
  };
}

// Cards keep their React keys and answer state. Preserve the visible card's
// position as well when this tab or another tab changes the shuffle preference.
function usePreserveCardPosition(setSlug, cards) {
  const anchor = React.useRef(null);
  React.useEffect(() => {
    anchor.current = null;
    return useStudyReaderStore.subscribe((next, previous) => {
      const orderFor = (state) =>
        isShuffleEnabled(state, setSlug)
          ? getQuestionOrder(state, setSlug)
          : null;
      if (orderFor(next) === orderFor(previous)) {
        return;
      }
      const elements = [...document.querySelectorAll("[data-study-card-id]")];
      const focused = document.activeElement?.closest("[data-study-card-id]");
      const midpoint = window.innerHeight / 2;
      const visible = elements
        .map((element) => ({
          element,
          bounds: element.getBoundingClientRect(),
        }))
        .filter(
          ({ bounds }) => bounds.bottom > 0 && bounds.top < window.innerHeight,
        )
        .sort((left, right) => {
          const distance = ({ bounds }) =>
            Math.max(bounds.top - midpoint, midpoint - bounds.bottom, 0);
          return distance(left) - distance(right);
        });
      const current = focused || visible[0]?.element;
      anchor.current = current
        ? {
            id: current.dataset.studyCardId,
            top: current.getBoundingClientRect().top,
          }
        : null;
    });
  }, [setSlug]);
  React.useLayoutEffect(() => {
    if (!anchor.current) {
      return;
    }
    const previous = anchor.current;
    anchor.current = null;
    const current = [...document.querySelectorAll("[data-study-card-id]")].find(
      (element) => element.dataset.studyCardId === previous.id,
    );
    if (current) {
      window.scrollBy({
        top: current.getBoundingClientRect().top - previous.top,
        behavior: "instant",
      });
    }
  }, [cards]);
}

export default function SetRoute() {
  const loaderData = useLoaderData();
  const revalidator = useRevalidator();
  const hydratedLoader = React.useRef(null);
  const records = useStudySetsStore((state) => state.records);
  const status = useStudySetsStore((state) => state.status);
  const storeError = useStudySetsStore((state) => state.error);
  const localRecords =
    hydratedLoader.current === loaderData ? records : loaderData.records;
  const loaderSet = selectLocalSetBySlug(
    loaderData.records,
    loaderData.setSlug,
  );
  const liveSet = selectLocalSetBySlug(localRecords, loaderData.setSlug);
  const set = liveSet || (status !== "ready" ? loaderSet : null);
  const previouslyShown = React.useRef(null);

  useHydrateStudySetsStore(loaderData.records, loaderData.storageError);
  React.useEffect(() => {
    hydratedLoader.current = loaderData;
  }, [loaderData]);
  React.useEffect(() => {
    if (set) {
      previouslyShown.current = loaderData.setSlug;
    }
  }, [set, loaderData.setSlug]);

  if (
    hydratedLoader.current === loaderData &&
    status === "ready" &&
    !set &&
    previouslyShown.current === loaderData.setSlug
  ) {
    const nextSet = selectFirstLocalSet(localRecords);
    return <Navigate to={nextSet ? `/sets/${nextSet.slug}` : "/"} replace />;
  }
  if (!set) {
    const error =
      hydratedLoader.current === loaderData && status === "ready"
        ? storeError
        : storeError || loaderData.storageError;
    return (
      <div
        className="min-h-dvh bg-background"
        style={{ "--study-app-header-height": "56px" }}
      >
        <StudyAppHeader activeSlug={loaderData.setSlug} />
        <main className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-8 sm:px-6">
          {error ? (
            <>
              <p role="alert" className="text-body-md text-muted-foreground">
                Study set could not be loaded.
              </p>
              <Button
                variant="ghost"
                onClick={() => revalidator.revalidate()}
                disabled={revalidator.state !== "idle"}
              >
                {revalidator.state === "idle" ? "Retry" : "Retrying…"}
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-headline-md">Study set not found</h1>
              <ButtonLink to="/" variant="ghost">
                Library
              </ButtonLink>
            </>
          )}
        </main>
      </div>
    );
  }
  return <LoadedSet set={set} />;
}

function LoadedSet({ set }) {
  const shuffleEnabled = useStudyReaderStore((state) =>
    isShuffleEnabled(state, set.slug),
  );
  const questionOrder = useStudyReaderStore((state) =>
    getQuestionOrder(state, set.slug),
  );
  const cards = React.useMemo(
    () =>
      getOrderedStudyCards(
        set.cards,
        shuffleEnabled ? questionOrder : undefined,
      ),
    [set.cards, questionOrder, shuffleEnabled],
  );
  usePreserveCardPosition(set.slug, cards);
  React.useLayoutEffect(() => {
    useStudyReaderStore.getState().ensureQuestionOrder(set.slug, set.cards);
  }, [set.slug, set.cards, shuffleEnabled]);
  return (
    <StudyShell set={set}>
      {cards.map((card, i) => (
        <StudyCard key={card.id} card={card} index={i} setSlug={set.slug} />
      ))}
      {set.cards.length > 0 ? <StudySetEndCap /> : null}
    </StudyShell>
  );
}

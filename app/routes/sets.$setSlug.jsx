import * as React from "react";
import { Navigate, redirect, useLoaderData } from "react-router";

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
import {
  fallbackSetSlug,
  getFallbackStudySet,
  selectFirstLocalSet,
  selectLocalSetBySlug,
} from "@/lib/study-sets";
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

  try {
    activateStudyPacksFromUrl(request.url);
    records = await listStudySetRecords();
  } catch {
    const fallbackSet = getFallbackStudySet();
    useStudyReaderStore
      .getState()
      .ensureQuestionOrder(fallbackSet.slug, fallbackSet.cards);

    return {
      records: [],
      setSlug: fallbackSet.slug,
      setTitle: fallbackSet.title,
      useFallback: true,
      storageError: "Study sets could not be loaded.",
    };
  }

  const localSet = selectLocalSetBySlug(records, params.setSlug);

  if (localSet) {
    useStudyReaderStore
      .getState()
      .ensureQuestionOrder(localSet.slug, localSet.cards);
    return {
      records,
      setSlug: localSet.slug,
      setTitle: localSet.title,
      useFallback: false,
      storageError: null,
    };
  }

  if (params.setSlug === fallbackSetSlug) {
    const fallbackSet = getFallbackStudySet();
    useStudyReaderStore
      .getState()
      .ensureQuestionOrder(fallbackSet.slug, fallbackSet.cards);

    return {
      records,
      setSlug: fallbackSet.slug,
      setTitle: fallbackSet.title,
      useFallback: true,
      storageError: null,
    };
  }

  const firstSet = selectFirstLocalSet(records);

  if (firstSet) {
    throw redirect(`/sets/${firstSet.slug}`);
  }

  throw redirect("/");
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
  const hydratedLoader = React.useRef(null);
  const records = useStudySetsStore((state) => state.records);
  const status = useStudySetsStore((state) => state.status);
  const localRecords = status === "ready" ? records : loaderData.records;
  const loaderSet = loaderData.useFallback
    ? getFallbackStudySet()
    : selectLocalSetBySlug(loaderData.records, loaderData.setSlug);
  const liveSet = loaderData.useFallback
    ? getFallbackStudySet()
    : selectLocalSetBySlug(localRecords, loaderData.setSlug);
  const set = liveSet ?? loaderSet ?? getFallbackStudySet();
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

  useHydrateStudySetsStore(loaderData.records, loaderData.storageError);
  React.useEffect(() => {
    hydratedLoader.current = loaderData;
  }, [loaderData]);

  if (
    hydratedLoader.current === loaderData &&
    status === "ready" &&
    !loaderData.useFallback &&
    !liveSet
  ) {
    const nextSet = selectFirstLocalSet(localRecords);
    return <Navigate to={nextSet ? `/sets/${nextSet.slug}` : "/"} replace />;
  }

  return (
    <StudyShell set={set}>
      {cards.map((card, i) => (
        <StudyCard key={card.id} card={card} index={i} setSlug={set.slug} />
      ))}
      {set.cards.length > 0 ? <StudySetEndCap /> : null}
    </StudyShell>
  );
}

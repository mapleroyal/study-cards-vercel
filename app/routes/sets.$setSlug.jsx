import * as React from "react";
import { Navigate, redirect, useLoaderData } from "react-router";

import { StudyShell } from "@/components/study/study-shell";
import { StudyCard } from "@/components/study/study-card";
import { StudySetEndCap } from "@/components/study/study-set-end-cap";
import {
  getOrderedStudyCards,
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
  const questionOrder = useStudyReaderStore(
    (state) => state.questionOrders[set.slug],
  );
  const cards = React.useMemo(
    () => getOrderedStudyCards(set.cards, questionOrder),
    [set.cards, questionOrder],
  );

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

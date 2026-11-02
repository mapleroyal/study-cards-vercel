import { PlusIcon } from "@primer/octicons-react";
import { ButtonLink } from "@/components/button-link";

export function GenerateCardsButton({ onClick, ...props }) {
  return (
    <ButtonLink to="/generate" variant="ghost" onClick={onClick} {...props}>
      <PlusIcon aria-hidden="true" />
      Generate cards
    </ButtonLink>
  );
}

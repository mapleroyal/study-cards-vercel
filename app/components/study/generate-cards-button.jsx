import { Link } from "react-router";
import { PlusIcon } from "@primer/octicons-react";
import { Button } from "@/components/ui/button";

export function GenerateCardsButton({ onClick, ...props }) {
  return (
    <Button asChild {...props}>
      <Link to="/generate" onClick={onClick}>
        <PlusIcon aria-hidden="true" />
        Generate cards
      </Link>
    </Button>
  );
}

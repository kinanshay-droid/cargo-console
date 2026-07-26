import { createFileRoute, redirect } from "@tanstack/react-router";

// Cases moved from Operations to Shipments — keep this route alive as a
// redirect so any old links (bookmarks, sessionStorage highlight flags)
// still land somewhere useful instead of 404ing.
export const Route = createFileRoute("/dashboard/operations/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/dashboard/shipments/$id", params: { id: params.id } });
  },
});

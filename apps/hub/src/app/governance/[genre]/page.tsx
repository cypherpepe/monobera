import React from "react";
import { notFound } from "next/navigation";

import { PROPOSAL_GENRE } from "../types";
import GovernanceByStatus from "./components/governance-by-status";

const GOVERNANCE_GENRES = ["berahub", "honey", "bend", "berps", "general"];

export default function Page({
  params,
}: {
  params: { genre: PROPOSAL_GENRE };
}) {
  if (!GOVERNANCE_GENRES.includes(params.genre)) return notFound();

  return <GovernanceByStatus genre={params.genre} />;
}

export async function generateStaticParams() {
  return GOVERNANCE_GENRES.map((genre) => ({
    genre,
  }));
}

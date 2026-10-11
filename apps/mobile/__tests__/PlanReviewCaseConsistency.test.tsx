import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PlanReviewQueueDemo } from "../src/PlanReviewQueueDemo";
import {
  DEMO_PENDING_REVIEWS, projectDemoPendingReviews, type DemoPendingReview,
} from "../src/reviewQueueDemo";
import { DEMO_PLAN_DRAFTS, type DemoPlanDraft } from "../src/planDraftDemo";

describe("MOB-HC-REVIEW-02 only pending requests for existing synthetic DRAFT plans", () => {
  test("projects precisely two source-linked pending requests, without patient names or approval", () => {
    const rows = projectDemoPendingReviews();
    expect(rows).toEqual([
      { id: "REV-DEMO-A-1", episodeRef: "DEMO-EPI-A", version: 1, state: "PENDIENTE" },
      { id: "REV-DEMO-B-2", episodeRef: "DEMO-EPI-B", version: 2, state: "PENDIENTE" },
    ]);
    expect(Object.isFrozen(DEMO_PENDING_REVIEWS)).toBe(true);
    expect(DEMO_PENDING_REVIEWS.every(item => Object.isFrozen(item))).toBe(true);
    expect(rows.every(item => Object.keys(item).sort().join(",") === "episodeRef,id,state,version")).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/medicaci[oó]n|diagn[oó]stico|real person|approved_by/i);
  });

  test("a review request does not exist unless the exact DRAFT version exists", () => {
    expect(projectDemoPendingReviews(DEMO_PENDING_REVIEWS, DEMO_PLAN_DRAFTS.slice(0, 2))).toEqual([]);
    const approved: DemoPlanDraft = { ...DEMO_PLAN_DRAFTS[0], planState: "APPROVED" as never };
    expect(projectDemoPendingReviews([DEMO_PENDING_REVIEWS[0]], [approved])).toEqual([]);
    expect(projectDemoPendingReviews([], DEMO_PLAN_DRAFTS)).toEqual([]);
    expect(projectDemoPendingReviews([DEMO_PENDING_REVIEWS[0]], DEMO_PLAN_DRAFTS)).toEqual([
      { id: "REV-DEMO-A-1", episodeRef: "DEMO-EPI-A", version: 1, state: "PENDIENTE" },
    ]);
  });

  test("all requests fail closed on invalid patient/episode, duplicate, status, injected fields or version", () => {
    const source = DEMO_PENDING_REVIEWS[0];
    const bad: DemoPendingReview[] = [
      { ...source, episodeRef: "DEMO-EPI-B" },
      { ...source, patientRef: "DEMO-PAT-B" },
      { ...source, patientRef: "patient-real" },
      { ...source, id: "REV-DEMO-B-1" },
      { ...source, planVersion: 0 },
      { ...source, planVersion: 1.5 },
      { ...source, planVersion: 1000 },
      { ...source, requestState: "APPROVED" as never },
      { ...source, clinicalNarrative: "DO NOT DISPLAY" } as DemoPendingReview,
      { ...source, signedBy: "REAL PERSON NAME" } as DemoPendingReview,
    ];
    for (const request of bad) {
      expect(projectDemoPendingReviews([request])).toEqual([]);
      expect(projectDemoPendingReviews([source, request])).toEqual([]);
    }
    expect(projectDemoPendingReviews([source, { ...source }])).toEqual([]);
  });

  test("request order cannot overwrite source version identity", () => {
    expect(projectDemoPendingReviews([...DEMO_PENDING_REVIEWS].reverse())).toEqual(
      projectDemoPendingReviews(DEMO_PENDING_REVIEWS));
    const wrongVersion={ ...DEMO_PENDING_REVIEWS[1],id:"REV-DEMO-B-3",planVersion:3 };
    expect(projectDemoPendingReviews([wrongVersion])).toEqual([]);
  });

  test("phone/tablet review UI never exposes approvals, real patient identity or writable clinical fields", () => {
    render(<PlanReviewQueueDemo />);
    expect(screen.getByText("Solicitudes de revisión")).toBeTruthy();
    expect(screen.getAllByText("PENDIENTE")).toHaveLength(2);
    expect(screen.getByTestId("review-REV-DEMO-A-1")).toBeTruthy();
    expect(screen.getByTestId("review-REV-DEMO-B-2")).toBeTruthy();
    expect(screen.getByText("Episodio: DEMO-EPI-A")).toBeTruthy();
    expect(screen.getByText("Episodio: DEMO-EPI-B")).toBeTruthy();
    expect(screen.getByText("SIN APROBACIONES NI ACTIVACIÓN CLÍNICA")).toBeTruthy();
    expect(screen.queryByRole("button", {name:/Aprobar|Firmar|Activar|Medicar/i})).toBeNull();
    expect(screen.queryByRole("textbox", {name:/Diagn[oó]stico|Medicaci[oó]n|Evoluci[oó]n/i})).toBeNull();
  });
});

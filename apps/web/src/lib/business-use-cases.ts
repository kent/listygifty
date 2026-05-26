export const BUSINESS_USE_CASES = [
  {
    id: "holiday-box",
    title: "Remote-team holiday box",
    description: "Import recipients, attach shipping addresses, load gifts, and flag fulfillment gaps.",
    workspaceName: "Holiday Gifting",
    href: "/business/signup?use_case=holiday-box",
  },
  {
    id: "new-hire-kit",
    title: "New-hire onboarding kit",
    description: "Track welcome gifts from accepted offer through first-day delivery.",
    workspaceName: "Onboarding Gifts",
    href: "/business/signup?use_case=new-hire-kit",
  },
  {
    id: "milestones",
    title: "Work anniversaries and milestones",
    description: "Plan birthdays, anniversaries, promotions, parental leave, and milestone gifts.",
    workspaceName: "Milestone Gifts",
    href: "/business/signup?use_case=milestones",
  },
] as const;

export type BusinessUseCase = (typeof BUSINESS_USE_CASES)[number];
export type BusinessUseCaseId = BusinessUseCase["id"];
export const DEFAULT_BUSINESS_USE_CASE = BUSINESS_USE_CASES[0];

export function getBusinessUseCase(useCaseId: string | null | undefined): BusinessUseCase {
  return BUSINESS_USE_CASES.find((useCase) => useCase.id === useCaseId) ?? DEFAULT_BUSINESS_USE_CASE;
}

export function getBusinessUseCaseLabel(useCaseId: string | null | undefined): string | null {
  if (!useCaseId) {
    return null;
  }

  return BUSINESS_USE_CASES.find((useCase) => useCase.id === useCaseId)?.title ?? useCaseId;
}

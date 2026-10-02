import { NumberPractice } from "@/components/numbers/number-practice";

export default async function NumbersPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const { prompt } = await searchParams;
  return <NumberPractice initialPromptId={typeof prompt === "string" ? prompt : undefined} />;
}

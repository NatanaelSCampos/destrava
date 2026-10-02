import { BasicsLibrary } from "@/components/basics/basics-library";

export default async function BasicsPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const { topic } = await searchParams;
  return <BasicsLibrary topic={topic === "numbers" ? "numbers" : "alphabet"} />;
}

import Evidence from "@/components/evidence";
export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams; const initial = Object.fromEntries(Object.entries(input).filter((x): x is [
    string,
    string
  ] => typeof x[1] === "string")); return <Evidence initial={initial} />;
}

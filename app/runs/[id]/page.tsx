import RunWorkspace from "@/components/run-workspace";
export default async function Run({ params }: {
  params: Promise<{
    id: string;
  }>;
}) { const { id } = await params; return <RunWorkspace id={id} />; }

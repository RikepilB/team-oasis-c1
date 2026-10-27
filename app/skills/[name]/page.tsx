import { SkillDetail } from "@/components/skills";
export default async function Page({ params }: { params: Promise<{ name: string }> }) { const { name } = await params; return <SkillDetail name={name} />; }

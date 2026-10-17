import { z } from "zod";
import { getRecord } from "@/lib/demo/workflow";
import { checkFact } from "@/lib/demo/verify";
export const Question = z.object({ question:z.string().trim().min(2).max(500),language:z.enum(["en","fr"]).default("en") }).strict();
export type EvidenceAnswer = { answer:string; mode:"verified_api"; citations:{id:string;file:string;location:string;quote:string}[]; links:{label:string;href:string}[] };
export async function answerQuestion(id:string,input:unknown):Promise<EvidenceAnswer> {
 const {question,language}=Question.parse(input);const r=await getRecord(id);const fr=language==="fr";
 const link={label:fr?"Ouvrir le rapport":"Open report",href:"/runs/"+encodeURIComponent(r.record_id)};
 if(/missing|lack|incomplete|why|manqu|pourquoi|absen/i.test(question)) {
  const missing=Object.values(r.templates).flatMap(t=>t.checks.filter(c=>!c.passed).map(c=>c.label));
  if(!r.facts.length)missing.push(fr?"Extraction des faits non effectuée":"Facts have not been extracted");
  if(!Object.keys(r.templates).length)missing.push(fr?"Gabarit du bailleur non préparé":"Funder template has not been prepared");
  for(const t of Object.values(r.templates)){if(t.language==="fr"&&t.review?.revision!==t.revision)missing.push(fr?"Révision humaine du texte français final":"Human review of the final French report");if(!t.approval)missing.push(fr?"Approbation du contenu":"Content approval");}
  return {mode:"verified_api",answer:missing.length?(fr?"À examiner : ":"Needs review: ")+[...new Set(missing)].join("; "):(fr?"Aucun élément manquant détecté par les contrôles actuels. La décision reste humaine.":"No missing element was identified by the current checks. A person still decides."),citations:[],links:[link]};
 }
 const stop=new Set(["where","what","which","this","that","from","find","data","report","source","number","does","come","can","the","for","and","are","les","des","une","dans","quel","quelle","donnée","trouver","rapport","vient"]);
 const tokens=question.toLocaleLowerCase().split(/[^\p{L}\p{N}%]+/u).filter(s=>s.length>1&&!stop.has(s));
 const verified=r.facts.filter(f=>checkFact(f,r.original_text).check==="green");
 const facts=verified.filter(f=>!tokens.length||tokens.some(s=>(f.label+" "+f.quote+" "+f.value).toLocaleLowerCase().includes(s))).slice(0,5);
 const citations=facts.map(f=>({id:f.fact_id,file:r.source_file,location:r.source_location,quote:f.quote}));
 const links=[link];
 if(/function|working|water|point|fonct|eau|%|percent/i.test(question))links.push({label:fr?"Voir l’instantané des données":"View evidence snapshot",href:"/evidence/water-points?"+new URLSearchParams({snapshot:r.snapshot_id,cutoff:r.period_end}).toString()});
 return {mode:"verified_api",answer:facts.length?(fr?"Faits vérifiés correspondants dans le rapport d’origine. Vérifiez les citations ci-dessous.":"Matching verified facts from the original report. Check the quotations below."):(fr?"Aucun fait vérifié ne correspond à cette question. Extrayez les faits ou examinez le rapport d’origine; aucune valeur n’a été inventée.":"No verified fact matches this question. Extract the facts or examine the original report; no value was invented."),citations,links};
}

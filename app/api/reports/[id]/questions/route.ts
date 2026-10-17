import { answerQuestion } from "@/lib/demo/questions";
import { respond } from "@/lib/demo/http";
import { DemoError } from "@/lib/demo/types";
export const dynamic="force-dynamic";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) { return respond(async()=>{const text=await req.text();if(text.length>2000)throw new DemoError("too_large","Question is too long.",413);let input:unknown;try{input=JSON.parse(text);}catch{throw new DemoError("invalid_json","Use a JSON request body.");}return answerQuestion((await params).id,input);}); }

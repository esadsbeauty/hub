import type { ReactNode } from "react";
import { BlogDiagnosticCta } from "./blog-diagnostic-cta";

const inline = (text: string): ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)$/);
    return link ? <a key={index} href={link[2]} target={link[2].startsWith("http") ? "_blank" : undefined} rel="noreferrer">{link[1]}</a> : part;
  });
};

type Block = { kind: "h1"|"h2"|"h3"|"p"|"quote"|"callout"|"hr"|"ul"|"ol"; text?: string; items?: string[] };
function parse(content: string): Block[] {
  const blocks: Block[] = []; let list: string[] = []; let ordered = false;
  const flush = () => { if (list.length) blocks.push({ kind: ordered ? "ol" : "ul", items: list }); list = []; };
  content.split("\n").forEach(raw => { const line = raw.trim();
    const numbered = line.match(/^\d+\.\s+(.+)/); if (line.startsWith("- ") || numbered) { const nextOrdered = Boolean(numbered); if (list.length && ordered !== nextOrdered) flush(); ordered = nextOrdered; list.push(numbered?.[1] ?? line.slice(2)); return; }
    flush(); if (!line) return; if (line === "---") blocks.push({kind:"hr"}); else if(line.startsWith("# ")) blocks.push({kind:"h1",text:line.slice(2)}); else if(line.startsWith("## ")) blocks.push({kind:"h2",text:line.slice(3)}); else if(line.startsWith("### ")) blocks.push({kind:"h3",text:line.slice(4)}); else if(line.startsWith("> ")) blocks.push({kind:"quote",text:line.slice(2)}); else if(line.startsWith("! ")) blocks.push({kind:"callout",text:line.slice(2)}); else blocks.push({kind:"p",text:line});
  }); flush(); return blocks;
}
export function BlogContent({content}:{content:string}) {
  const blocks = parse(content); const h2Indexes = blocks.map((block,index)=>block.kind==="h2"?index:-1).filter(index=>index>=0); const insertAfter = h2Indexes[Math.floor(h2Indexes.length/2)] ?? Math.floor(blocks.length/2);
  const render = (block:Block,index:number) => { const value=inline(block.text??""); if(block.kind==="h1")return <h1 key={index}>{value}</h1>;if(block.kind==="h2")return <h2 key={index}>{value}</h2>;if(block.kind==="h3")return <h3 key={index}>{value}</h3>;if(block.kind==="quote")return <blockquote key={index}>{value}</blockquote>;if(block.kind==="callout")return <div className="blog-callout" key={index}>{value}</div>;if(block.kind==="hr")return <hr key={index}/>;if(block.kind==="ul"||block.kind==="ol"){const Tag=block.kind;return <Tag key={index}>{block.items?.map((item,itemIndex)=><li key={itemIndex}>{inline(item)}</li>)}</Tag>}return <p key={index}>{value}</p> };
  return <div className="blog-prose">{blocks.flatMap((block,index)=>[render(block,index),index===insertAfter?<BlogDiagnosticCta key="diagnostic-middle"/>:null])}</div>;
}

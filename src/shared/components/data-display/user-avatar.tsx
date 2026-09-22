import { cn } from "@/lib/utils";

const sizes={sm:"h-9 w-9 text-xs",md:"h-11 w-11 text-sm",lg:"h-24 w-24 text-2xl"} as const;
const initials=(name?:string,email?:string)=>{const source=name?.trim()||email?.split("@")[0]||"ES";const parts=source.split(/\s+/).filter(Boolean);return `${parts[0]?.[0]??"E"}${parts.length>1?parts.at(-1)?.[0]??"":""}`.toUpperCase()};

export function UserAvatar({name,email,src,size="md",className}:{name?:string;email?:string;src?:string;size?:keyof typeof sizes;className?:string}){
  return <span aria-label={name?`Foto de ${name}`:"Avatar do usuário"} className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-champagne-soft font-bold text-champagne-dark",sizes[size],className)}>{src?<img src={src} alt="" className="h-full w-full object-cover"/>:<span aria-hidden>{initials(name,email)}</span>}</span>;
}

import{useEffect,useMemo,useRef,useState}from"react";
import{useSearchParams}from"react-router-dom";
import{MessageCircle,RefreshCw}from"lucide-react";
import{Button}from"@/components/ui/button";
import{useAppState}from"@/shared/state/app-state-context";
import{ChatPanel}from"../components/chat-panel";
import{ConversationList}from"../components/conversation-list";
import{CrmPanel}from"../components/crm-panel";
import{useSendWhatsAppMessage,useWhatsAppInbox,useWhatsAppMessages,useWhatsAppRealtime}from"../hooks/use-whatsapp-inbox";
import type{WhatsAppConversation}from"../types";

const digits=(value?:string)=>(value??"").replace(/\D/g,"");

const phoneMatches=(left?:string,right?:string)=>{
  const a=digits(left),b=digits(right);
  if(!a||!b)return false;
  if(a===b)return true;

  const aWithoutCountry=a.startsWith("55")?a.slice(2):a;
  const bWithoutCountry=b.startsWith("55")?b.slice(2):b;

  if(aWithoutCountry===bWithoutCountry)return true;

  const a10=aWithoutCountry.length>=10?aWithoutCountry.slice(-10):aWithoutCountry;
  const b10=bWithoutCountry.length>=10?bWithoutCountry.slice(-10):bWithoutCountry;

  return a10===b10;
};

const externalWhatsAppUrl=(phone:string)=>{
  const normalized=digits(phone);
  if(!normalized)return undefined;
  const withCountry=normalized.startsWith("55")?normalized:`55${normalized}`;
  return `https://wa.me/${withCountry}`;
};

export function WhatsAppInboxPage(){
  const[searchParams]=useSearchParams();
  const{organizationId,role,isPlatformAdmin}=useAppState(),
  inbox=useWhatsAppInbox(),
  [selectedId,setSelectedId]=useState<string>(),
  [query,setQuery]=useState(""),
  [status,setStatus]=useState("all"),
  [details,setDetails]=useState(false),
  deepLinkHandled=useRef("");

  const selected=inbox.data?.conversations.find(item=>item.id===selectedId);
  const messages=useWhatsAppMessages(selectedId);
  const send=useSendWhatsAppMessage(selectedId);
  const canReply=isPlatformAdmin||["owner","admin","manager","sales","operations","marketing"].includes(role);

  useWhatsAppRealtime();

  useEffect(()=>{
    setSelectedId(undefined);
    setDetails(false);
    deepLinkHandled.current="";
  },[organizationId]);

  useEffect(()=>{
    if(inbox.isLoading||!inbox.data)return;

    const opportunity=searchParams.get("opportunity")??"";
    const contact=searchParams.get("contact")??"";
    const phone=searchParams.get("phone")??"";

    if(!opportunity&&!contact&&!phone)return;

    const key=`${organizationId}|${opportunity}|${contact}|${phone}`;
    if(deepLinkHandled.current===key)return;

    const conversations=inbox.data.conversations??[];
    const match=conversations.find(item=>
      (opportunity&&item.opportunityId===opportunity)||
      (contact&&item.contactId===contact)||
      (phone&&phoneMatches(item.waId,phone))
    );

    deepLinkHandled.current=key;

    if(match){
      setSelectedId(match.id);
      setDetails(false);
      return;
    }

    if(phone){
      const url=externalWhatsAppUrl(phone);
      if(url)window.open(url,"_blank","noopener,noreferrer");
    }
  },[inbox.data,inbox.isLoading,organizationId,searchParams]);

  const filtered=useMemo(()=>{
    const normalized=query.trim().toLocaleLowerCase("pt-BR");
    return(inbox.data?.conversations??[]).filter(item=>
      (status==="all"||item.status===status)&&
      (!normalized||`${item.contactName??""} ${item.waId}`.toLocaleLowerCase("pt-BR").includes(normalized))
    );
  },[inbox.data?.conversations,query,status]);

  const select=(conversation:WhatsAppConversation)=>{
    setSelectedId(conversation.id);
    setDetails(false);
  };

  if(inbox.isLoading)return<div className="grid min-h-[60dvh] place-items-center text-sm text-muted-foreground">Carregando Inbox WhatsApp…</div>;

  if(inbox.isError)return<div className="grid min-h-[60dvh] place-items-center text-center"><div><p className="font-semibold">Não foi possível carregar a Inbox.</p><p className="mt-2 text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p><Button className="mt-5" variant="outline" onClick={()=>void inbox.refetch()}><RefreshCw size={17}/>Tentar novamente</Button></div></div>;

  if(!inbox.data?.connection)return<div className="grid min-h-[60dvh] place-items-center text-center"><div className="max-w-md"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-champagne-soft text-champagne-dark"><MessageCircle/></span><h1 className="mt-5 text-2xl font-semibold">WhatsApp ainda não conectado</h1><p className="mt-3 leading-7 text-muted-foreground">Conecte uma conta do WhatsApp Business para receber conversas diretamente no CRM.</p><Button className="mt-6" disabled>Configurar WhatsApp</Button><p className="mt-2 text-xs text-muted-foreground">Configuração disponível em uma próxima etapa.</p></div></div>;

  return<div className="-mx-4 -my-6 min-[430px]:-mx-5 md:-mx-6 md:-my-8 lg:-mx-8">
    <div className="grid h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-0 min-w-0 overflow-hidden border-y bg-card md:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_19rem]">
      <div className={`min-h-0 min-w-0 overflow-hidden ${selected?"hidden md:flex":"flex"}`}>
        <ConversationList items={filtered} selectedId={selectedId} query={query} status={status} onQuery={setQuery} onStatus={setStatus} onSelect={select}/>
      </div>
      <div className={!selected?"hidden min-h-0 min-w-0 overflow-hidden md:block":"min-h-0 min-w-0 overflow-hidden"}>
        <ChatPanel conversation={selected} messages={messages.data??[]} loading={messages.isLoading} sending={send.isPending} canReply={canReply} onSend={text=>send.mutateAsync(text)} onBack={()=>setSelectedId(undefined)} onDetails={()=>setDetails(true)}/>
      </div>
      <CrmPanel conversation={selected}/>
      {details&&<><button className="fixed inset-0 z-40 bg-black/40 xl:hidden" aria-label="Fechar informações" onClick={()=>setDetails(false)}/><CrmPanel conversation={selected} drawer onClose={()=>setDetails(false)}/></>}
    </div>
  </div>;
}

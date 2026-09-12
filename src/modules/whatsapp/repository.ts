import{isLocalMode}from"@/config/app-mode";
import{supabase}from"@/lib/supabase";
import type{WhatsAppConnection,WhatsAppConversation,WhatsAppInboxData,WhatsAppMessage}from"./types";

type Row=Record<string,unknown>;

const text=(v:unknown)=>v==null?undefined:String(v);

const relationName=(v:unknown,key:string)=>{
  const value=Array.isArray(v)?v[0]:v;
  return value&&typeof value==="object"
    ?text((value as Row)[key])
    :undefined;
};

const mapMessage=(r:Row):WhatsAppMessage=>({
  id:String(r.id),
  organizationId:String(r.organization_id),
  conversationId:String(r.conversation_id),
  externalMessageId:String(r.external_message_id),
  direction:r.direction as "inbound"|"outbound",
  messageType:String(r.message_type),
  textBody:text(r.text_body),
  messageTimestamp:text(r.message_timestamp),
  createdAt:String(r.created_at)
});

const mapConversation=(r:Row,last?:WhatsAppMessage):WhatsAppConversation=>({
  id:String(r.id),
  organizationId:String(r.organization_id),
  connectionId:String(r.connection_id),
  companyId:text(r.company_id),
  contactId:text(r.contact_id),
  opportunityId:text(r.opportunity_id),
  waId:String(r.wa_id),
  contactName:text(r.contact_name),
  status:String(r.status),
  assignedUserId:text(r.assigned_user_id),
  lastMessageAt:text(r.last_message_at),
  createdAt:String(r.created_at),
  updatedAt:String(r.updated_at),
  lastMessage:last,
  companyName:relationName(r.company,"name"),
  contactDisplayName:relationName(r.contact,"name"),
  opportunityTitle:relationName(r.opportunity,"title"),
  assignedUserName:relationName(r.assignee,"name")
});

const configured=()=>{
  if(!supabase)throw new Error("Não foi possível conectar à Inbox do WhatsApp.");
  return supabase;
};

export const whatsappRepository={
  async inbox(organizationId:string):Promise<WhatsAppInboxData>{
    if(isLocalMode)return{conversations:[]};

    const client=configured();

    const connectionResult=await client
      .from("whatsapp_connections")
      .select("id,organization_id,display_phone_number,status")
      .eq("organization_id",organizationId)
      .in("status",["active","connected"])
      .order("created_at",{ascending:false})
      .limit(1)
      .maybeSingle();

    if(connectionResult.error){
      throw new Error("Não foi possível carregar a conexão do WhatsApp.");
    }

    if(!connectionResult.data){
      return{conversations:[]};
    }

    const connection:WhatsAppConnection={
      id:String(connectionResult.data.id),
      organizationId:String(connectionResult.data.organization_id),
      displayPhoneNumber:String(connectionResult.data.display_phone_number),
      status:String(connectionResult.data.status)
    };

    const conversationResult=await client
      .from("whatsapp_conversations")
      .select("*")
      .eq("organization_id",organizationId)
      .eq("connection_id",connection.id)
      .order("last_message_at",{ascending:false,nullsFirst:false});

    if(conversationResult.error){
      throw new Error("Não foi possível carregar as conversas.");
    }

    const rows=conversationResult.data??[];
    const ids=rows.map(row=>String(row.id));
    const latest=new Map<string,WhatsAppMessage>();

    if(ids.length){
      const messageResult=await client
        .from("whatsapp_messages")
        .select("id,organization_id,conversation_id,external_message_id,direction,message_type,text_body,message_timestamp,created_at")
        .eq("organization_id",organizationId)
        .in("conversation_id",ids)
        .order("created_at",{ascending:false})
        .limit(Math.max(ids.length*10,100));

      if(messageResult.error){
        throw new Error("Não foi possível carregar as mensagens recentes.");
      }

      for(const row of messageResult.data??[]){
        const message=mapMessage(row as Row);
        const current=latest.get(message.conversationId);
        const at=new Date(message.messageTimestamp||message.createdAt).getTime();
        const currentAt=current
          ?new Date(current.messageTimestamp||current.createdAt).getTime()
          :0;

        if(!current||at>currentAt){
          latest.set(message.conversationId,message);
        }
      }
    }

    const idsFor=(key:string)=>[
      ...new Set(
        rows
          .map(row=>text((row as Row)[key]))
          .filter(Boolean) as string[]
      )
    ];

    const fetchNames=async(
      table:"companies"|"contacts"|"opportunities"|"profiles",
      ids:string[],
      column:"name"|"title"
    )=>{
      const values=new Map<string,string>();

      if(!ids.length)return values;

      const result=await client
        .from(table)
        .select(`id,${column}`)
        .eq("organization_id",organizationId)
        .in("id",ids);

      if(!result.error){
        for(const row of (result.data??[])as unknown as Row[]){
          values.set(String(row.id),String(row[column]));
        }
      }

      return values;
    };

    const[companies,contacts,opportunities,assignees]=await Promise.all([
      fetchNames("companies",idsFor("company_id"),"name"),
      fetchNames("contacts",idsFor("contact_id"),"name"),
      fetchNames("opportunities",idsFor("opportunity_id"),"title"),
      fetchNames("profiles",idsFor("assigned_user_id"),"name")
    ]);

    return{
      connection,
      conversations:rows.map(row=>{
        const mapped=mapConversation(
          row as Row,
          latest.get(String(row.id))
        );

        return{
          ...mapped,
          companyName:mapped.companyId
            ?companies.get(mapped.companyId)
            :undefined,
          contactDisplayName:mapped.contactId
            ?contacts.get(mapped.contactId)
            :undefined,
          opportunityTitle:mapped.opportunityId
            ?opportunities.get(mapped.opportunityId)
            :undefined,
          assignedUserName:mapped.assignedUserId
            ?assignees.get(mapped.assignedUserId)
            :undefined
        };
      })
    };
  },

  async messages(
    organizationId:string,
    conversationId:string
  ):Promise<WhatsAppMessage[]>{
    if(isLocalMode)return[];

    const result=await configured()
      .from("whatsapp_messages")
      .select("id,organization_id,conversation_id,external_message_id,direction,message_type,text_body,message_timestamp,created_at")
      .eq("organization_id",organizationId)
      .eq("conversation_id",conversationId)
      .order("message_timestamp",{ascending:true,nullsFirst:true})
      .order("created_at",{ascending:true});

    if(result.error){
      throw new Error("Não foi possível carregar o histórico desta conversa.");
    }

    return(result.data??[])
      .map(row=>mapMessage(row as Row))
      .sort(
        (a,b)=>
          new Date(a.messageTimestamp||a.createdAt).getTime()-
          new Date(b.messageTimestamp||b.createdAt).getTime()
      );
  },

  async sendMessage(
    input:{
      organizationId:string;
      conversationId:string;
      text:string;
    }
  ):Promise<{
    messageId?:string;
    externalMessageId:string;
  }>{
    if(isLocalMode){
      throw new Error("O envio real exige conexão com o Supabase.");
    }

    const result=await configured().functions.invoke(
      "whatsapp-send-message",
      {
        body:input
      }
    );

    if(result.error){
      let message="Não foi possível enviar a mensagem pelo WhatsApp.";

      const context=result.error.context as unknown;

      if(context&&typeof context==="object"){
        const candidate=context as{
          json?:()=>Promise<unknown>;
          message?:unknown;
        };

        if(typeof candidate.json==="function"){
          try{
            const payload=await candidate.json() as{
              message?:unknown;
            };

            if(typeof payload?.message==="string"&&payload.message.trim()){
              message=payload.message;
            }
          }catch{
            // Mantém a mensagem padrão.
          }
        }else if(
          typeof candidate.message==="string"&&
          candidate.message.trim()
        ){
          message=candidate.message;
        }
      }

      if(
        result.error.message&&
        result.error.message!=="Edge Function returned a non-2xx status code"
      ){
        message=result.error.message;
      }

      throw new Error(message);
    }

    return result.data as{
      messageId?:string;
      externalMessageId:string;
    };
  }
};

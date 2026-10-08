export type WhatsAppConnection={id:string;organizationId:string;displayPhoneNumber:string;status:string};
export type WhatsAppConversationStatus="open"|"closed"|string;
export type WhatsAppConversation={id:string;organizationId:string;connectionId:string;companyId?:string;contactId?:string;opportunityId?:string;waId:string;contactName?:string;status:WhatsAppConversationStatus;assignedUserId?:string;lastMessageAt?:string;createdAt:string;updatedAt:string;lastMessage?:WhatsAppMessage;companyName?:string;contactDisplayName?:string;opportunityTitle?:string;assignedUserName?:string};
export type WhatsAppMessage={id:string;organizationId:string;conversationId:string;externalMessageId:string;direction:"inbound"|"outbound";messageType:string;textBody?:string;messageTimestamp?:string;createdAt:string};
export type WhatsAppInboxData={connection?:WhatsAppConnection;conversations:WhatsAppConversation[]};

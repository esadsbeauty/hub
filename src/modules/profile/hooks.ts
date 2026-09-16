import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-context";

export type UserProfile={id:string;name:string;email:string;avatarPath?:string;avatarUrl?:string};
const allowed=new Map([["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"]]);
const key=(id:string)=>["current-user-profile",id] as const;
type ProfileRow={id:string;name:string;email:string;avatar_path?:string|null;avatar_url?:string|null};
const withUrl=(value:ProfileRow):UserProfile=>{const path=value.avatar_path??undefined;const publicUrl=path&&supabase?.storage.from("avatars").getPublicUrl(path).data.publicUrl;return{id:value.id,name:value.name,email:value.email,avatarPath:path,avatarUrl:publicUrl?`${publicUrl}?v=${Date.now()}`:value.avatar_url??undefined}};

export function useCurrentUserProfile(){const{user}=useAuth();return useQuery({queryKey:key(user?.id??"anonymous"),enabled:Boolean(user),queryFn:async()=>{if(!user)throw new Error("Usuário não autenticado.");if(isLocalMode||!supabase)return{id:user.id,name:user.user_metadata.name??user.email?.split("@")[0]??"Usuário",email:user.email??""};const result=await supabase.rpc("current_user_profile");if(result.error||!result.data)throw new Error("Não foi possível carregar seu perfil.");return withUrl(result.data as ProfileRow)}})}

export function useProfileActions(){const{user}=useAuth();const client=useQueryClient();const save=async(name:string,avatarPath?:string)=>{if(!user)throw new Error("Usuário não autenticado.");if(isLocalMode||!supabase){const value={id:user.id,name,email:user.email??"",avatarPath};client.setQueryData(key(user.id),value);return value}const result=await supabase.rpc("update_own_profile",{profile_name:name,next_avatar_path:avatarPath??null});if(result.error||!result.data)throw new Error("Não foi possível salvar seu perfil.");const value=withUrl(result.data as ProfileRow);client.setQueryData(key(user.id),value);return value};return{
  saveName:useMutation({mutationFn:({name,avatarPath}:{name:string;avatarPath?:string})=>save(name,avatarPath)}),
  uploadAvatar:useMutation({mutationFn:async({file,name,previousPath}:{file:File;name:string;previousPath?:string})=>{if(!user||!supabase||isLocalMode)throw new Error("O envio de foto exige conexão com o Supabase.");const extension=allowed.get(file.type);if(!extension)throw new Error("Envie uma imagem JPEG, PNG ou WebP.");if(file.size>5*1024*1024)throw new Error("A foto deve ter no máximo 5 MB.");const path=`${user.id}/avatar.${extension}`;const upload=await supabase.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});if(upload.error)throw new Error("Não foi possível enviar a foto.");const value=await save(name,path);if(previousPath&&previousPath!==path)await supabase.storage.from("avatars").remove([previousPath]);return value}}),
  removeAvatar:useMutation({mutationFn:async({name,path}:{name:string;path?:string})=>{if(path&&supabase&&!isLocalMode){const removal=await supabase.storage.from("avatars").remove([path]);if(removal.error)throw new Error("Não foi possível remover a foto.")}return save(name,undefined)}})
}}

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppQueryProvider } from "@/providers/query-provider";
import { PublicLayout } from "@/layouts/public-layout";
import { BlogIndexPage } from "@/modules/blog/pages/BlogIndexPage";
import { BlogPostPage } from "@/modules/blog/pages/BlogPostPage";
export default function PublicAppRoot(){return <AppQueryProvider><BrowserRouter><Routes><Route element={<PublicLayout/>}><Route path="/blog" element={<BlogIndexPage/>}/><Route path="/blog/:slug" element={<BlogPostPage/>}/></Route><Route path="*" element={<Navigate to="/blog" replace/>}/></Routes></BrowserRouter></AppQueryProvider>}

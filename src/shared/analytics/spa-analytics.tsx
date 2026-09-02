import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { dataLayerEventNames, pushDataLayerEvent } from "./data-layer";

let lastTrackedPage: string | undefined;

function isWhatsappLink(anchor: HTMLAnchorElement) {
  try {
    const hostname = new URL(anchor.href, window.location.href).hostname;
    return hostname === "wa.me" || hostname === "api.whatsapp.com" || hostname === "web.whatsapp.com";
  } catch {
    return false;
  }
}

export function SpaAnalytics() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const pagePath = `${pathname}${search}`;
    const timer = window.setTimeout(() => {
      if (lastTrackedPage === pagePath) return;
      lastTrackedPage = pagePath;
      pushDataLayerEvent(dataLayerEventNames.virtualPageView, {
        page_path: pagePath,
        page_title: document.title,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  useEffect(() => {
    const trackWhatsappClick = (event: MouseEvent) => {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a") : null;
      if (anchor instanceof HTMLAnchorElement && isWhatsappLink(anchor)) {
        pushDataLayerEvent(dataLayerEventNames.whatsappClick, {
          page_path: `${window.location.pathname}${window.location.search}`,
        });
      }
    };
    document.addEventListener("click", trackWhatsappClick);
    return () => document.removeEventListener("click", trackWhatsappClick);
  }, []);

  return null;
}

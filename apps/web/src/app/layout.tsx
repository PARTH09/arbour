import type { Metadata } from "next";
import { IBM_Plex_Mono, Outfit, Source_Sans_3 } from "next/font/google";
import Script from "next/script";

import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  weight: ["400", "500", "600", "700"],
});

const display = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Arbour",
  description: "A calm workspace for mind maps.",
};

/** Strip password-manager / extension attrs before React hydrates (avoids bis_skin_checked mismatches). */
const STRIP_EXTENSION_ATTRS = `(function(){function strip(el){if(!el||!el.removeAttribute||!el.attributes)return;for(var i=el.attributes.length-1;i>=0;i--){var n=el.attributes[i].name;if(n==="bis_skin_checked"||n.indexOf("bis_")==0||n.indexOf("__processed_")==0)el.removeAttribute(n);}}function walk(root){if(!root||root.nodeType!==1)return;strip(root);var all=root.querySelectorAll("*");for(var i=0;i<all.length;i++)strip(all[i]);}function boot(){walk(document.documentElement);var obs=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var m=muts[i];if(m.type==="attributes")strip(m.target);else if(m.addedNodes)for(var j=0;j<m.addedNodes.length;j++)walk(m.addedNodes[j]);}});obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true});setTimeout(function(){obs.disconnect();},4000);}if(document.documentElement)boot();else document.addEventListener("DOMContentLoaded",boot);})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Script id="strip-extension-attrs" strategy="beforeInteractive">
          {STRIP_EXTENSION_ATTRS}
        </Script>
        {children}
      </body>
    </html>
  );
}

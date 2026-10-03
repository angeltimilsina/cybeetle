// Public engine results are best effort. No engine success is inferred from configuration.
const engines={Google:'https://www.google.com/search?q=',Bing:'https://www.bing.com/search?q=',DuckDuckGo:'https://html.duckduckgo.com/html/?q=',Brave:'https://search.brave.com/search?q='};
export async function engineSearch(query:string,selected?:string){
 return Promise.all(Object.entries(engines).filter(([name])=>!selected||name===selected).map(async([engine,base])=>{
  const url=base+encodeURIComponent(query);try{
   const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'text/html','User-Agent':'Cybeetle/1.0'},redirect:'error'});
   if(!response.ok)return{engine,status:'unavailable',text:'',sources:[]};
   const reader=response.body?.getReader();if(!reader)throw Error('Empty response');const decoder=new TextDecoder();let html='',bytes=0;
   try{while(bytes<160000){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;html+=decoder.decode(chunk.value,{stream:true});}}finally{await reader.cancel()}
   const text=html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,7000);
   if(text.length<200||/unusual traffic|verify you are human|automated queries|enable javascript and cookies/i.test(text))return{engine,status:'blocked',text:'',sources:[]};
   const sources:Array<{title:string;url:string}>=[];for(const match of html.matchAll(/href=["']([^"']+)["']/gi)){try{let href=match[1].replace(/&amp;/g,'&');const u=new URL(href,url);const redirected=u.searchParams.get('uddg')||u.searchParams.get('q');if(redirected&&/^https?:/.test(redirected))href=redirected;else href=u.href;const target=new URL(href);if(!['http:','https:'].includes(target.protocol)||/google\.|bing\.|duckduckgo\.|brave\./i.test(target.hostname)||sources.some(s=>s.url===href))continue;sources.push({title:target.hostname,url:href});if(sources.length>=8)break}catch{}}
   // A usable result must include links rather than a consent or challenge screen.
   return sources.length?{engine,status:'fetched',text,sources}:{engine,status:'unavailable',text:'',sources:[]};
  }catch{return{engine,status:'unavailable',text:'',sources:[]}}
 }));
}

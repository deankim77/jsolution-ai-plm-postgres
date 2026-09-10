import {sessionTokenFromCookie,verifyAppSession} from "../lib/app-auth.ts";

const identityHeaders=["x-user-id","x-user-email","x-company-id","oai-authenticated-user-email","oai-authenticated-user-full-name","oai-authenticated-user-full-name-encoding","cf-access-authenticated-user-email"];
const devPrefixes=["/@vite/","/@id/","/@fs/","/node_modules/","/app/","/lib/","/_next/","/_vinext/"];
const publicFiles=new Set(["/@react-refresh","/favicon.svg","/favicon.ico","/window.svg","/globe.svg","/file.svg"]);

// Inspect headers only. Never construct a Fetch Request from the Node body.
export function createNodeSessionGate({getSecret=()=>process.env.APP_SESSION_SECRET||""}={}) {
  return async function nodeSessionGate(req,res,next) {
    try {
      for(const name of identityHeaders)delete req.headers[name];
      if(req.rawHeaders)req.rawHeaders=req.rawHeaders.reduce((pairs,value,index,all)=>{if(index%2===0&&!identityHeaders.includes(value.toLowerCase()))pairs.push(value,all[index+1]);return pairs;},[]);
      let pathname;
      try {pathname=decodeURIComponent(new URL(req.url||"/","http://localhost").pathname).replaceAll("\\","/");}
      catch {res.statusCode=400;res.end("Bad Request");return;}
      if(pathname.split("/").some(part=>part===".."||part===".git"||part===".env"||part.startsWith(".env.")||part===".dev.vars")) {
        res.statusCode=404;res.setHeader("Cache-Control","no-store");res.end("Not Found");return;
      }
      const read=req.method==="GET"||req.method==="HEAD";
      const publicAuth=(read&&pathname==="/login")||(req.method==="POST"&&(pathname==="/api/auth/login"||pathname==="/api/auth/logout"));
      const devAsset=read&&(publicFiles.has(pathname)||devPrefixes.some(prefix=>pathname.startsWith(prefix)));
      if(devAsset)return next();
      res.setHeader("Cache-Control","private, no-store");
      if(publicAuth)return next();
      const session=await verifyAppSession(sessionTokenFromCookie(req.headers.cookie||null),getSecret());
      if(!session) {
        if(pathname==="/api"||pathname.startsWith("/api/")||!read) {
          res.statusCode=401;res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify({error:"로그인이 필요합니다."}));
        } else {res.statusCode=302;res.setHeader("Location","/login");res.end();}
        return;
      }
      req.headers["oai-authenticated-user-email"]=session.email;
      if(req.rawHeaders)req.rawHeaders.push("oai-authenticated-user-email",session.email);
      return next();
    } catch(error) {next(error);}
  };
}

export function nodeSessionGatePlugin(){
  return {
    name:"plm:node-session-gate",enforce:"pre",apply:"serve",
    configureServer(server){
      if(!process.env.APP_SESSION_SECRET&&typeof process.loadEnvFile==="function") {
        for(const file of [".dev.vars",".env"])try{process.loadEnvFile(file)}catch{}
      }
      server.middlewares.use(createNodeSessionGate());
    },
  };
}

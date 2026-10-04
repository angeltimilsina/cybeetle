"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Globe2,
  LockKeyhole,
  Menu,
  MessageSquarePlus,
  Mic,
  Monitor,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type Message = { role: "user" | "assistant"; text: string };
type Mode = "Web" | "AI" | "Agent";

const starters = [
  "Research a topic across the web",
  "Compare two products",
  "Summarize a public webpage",
  "Plan a trip with sources",
];

export default function WebWorkspace({ displayName }: { displayName: string }) {
  const [mode, setMode] = useState<Mode>("Web");
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [status, setStatus] = useState("Ready");
  const abortRef = useRef<AbortController | null>(null);

  const firstName = useMemo(() => {
    const value = displayName.includes("@") ? "" : displayName.trim().split(/\s+/)[0];
    return value || "there";
  }, [displayName]);

  async function submit(value?: string) {
    const text = (value ?? prompt).trim();
    if (!text || busy) return;

    if (mode === "Agent") {
      window.location.href = "/workspace.html";
      return;
    }

    setPrompt("");
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setBusy(true);
    setStatus(mode === "Web" ? "Searching the web" : "Thinking");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          engine: "Google",
          prompt: text,
          history: next.slice(-10, -1),
          context: "",
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Cybeetle could not complete this request.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      const append = (chunk: string) => {
        answer += chunk;
        setMessages([...next, { role: "assistant", text: answer }]);
      };

      const consume = (line: string) => {
        const event = JSON.parse(line);
        if (event.type === "activity") setStatus(event.label || "Working");
        if (event.type === "error") throw new Error(event.message || "Request failed");
        if (event.type === "answer") {
          for (const result of event.results || []) {
            const body = result.text || "";
            append(answer ? "\n\n" + body : body);
          }
        }
      };

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        let at;
        while ((at = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, at).trim();
          buffer = buffer.slice(at + 1);
          if (line) consume(line);
        }
      }
      if (buffer.trim()) consume(buffer.trim());
      if (!answer) append("I completed the request, but no response text was returned.");
      setStatus("Ready");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages([...next, { role: "assistant", text: (error as Error).message }]);
        setStatus("Connection issue");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
    setStatus("Stopped");
  }

  function newChat() {
    if (busy) stop();
    setMessages([]);
    setPrompt("");
    setStatus("Ready");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  return (
    <main className="cy-web">
      <aside className={sidebar ? "cy-sidebar" : "cy-sidebar collapsed"}>
        <div className="side-top">
          <a className="cy-brand" href="/">
            <img src="/beetle.png" alt="Cybeetle" />
            <span>CYBEETLE</span>
          </a>
          <button className="icon-button" onClick={() => setSidebar(false)} aria-label="Close sidebar"><X size={18}/></button>
        </div>

        <button className="new-chat" onClick={newChat}>
          <MessageSquarePlus size={17}/> New chat
        </button>

        <nav className="side-links">
          <a href="/workspace.html"><Globe2 size={17}/> Live browser</a>
          <a href="/enterprise"><ShieldCheck size={17}/> Enterprise</a>
        </nav>

        <div className="history">
          <span className="side-label">RECENT</span>
          {messages.length ? (
            <button className="history-item active">
              <span>{messages.find(m => m.role === "user")?.text.slice(0, 34) || "Current conversation"}</span>
              <small>Current session</small>
            </button>
          ) : (
            <p>New conversations will appear here.</p>
          )}
        </div>

        <div className="side-bottom">
          <div className="secure-mini"><LockKeyhole size={15}/><span>Private session</span></div>
          <button className="profile">
            <span className="avatar">{firstName.slice(0,1).toUpperCase()}</span>
            <span><strong>{firstName}</strong><small>Cybeetle account</small></span>
          </button>
        </div>
      </aside>

      <section className="chat-shell">
        <header className="chat-header">
          <div className="header-left">
            {!sidebar && <button className="icon-button" onClick={() => setSidebar(true)} aria-label="Open sidebar"><Menu size={19}/></button>}
            <div className="mode-switcher">
              {(["Web","AI","Agent"] as Mode[]).map(item => (
                <button
                  key={item}
                  className={mode === item ? "active" : ""}
                  onClick={() => setMode(item)}
                >
                  {item === "Web" && <Globe2 size={15}/>}
                  {item === "AI" && <Sparkles size={15}/>}
                  {item === "Agent" && <Bot size={15}/>}
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="header-status">
            <span className={busy ? "status-dot working" : "status-dot"}/>
            {status}
          </div>
        </header>

        <div className="conversation">
          {!messages.length ? (
            <section className="empty-state">
              <div className="hero-logo"><img src="/beetle.png" alt=""/></div>
              <span className="eyebrow">CYBEETLE WEB</span>
              <h1>What are we exploring today?</h1>
              <p>
                Search the live web, reason across sources, or hand a task to Cybeetle's browser agent.
              </p>

              <div className="starter-grid">
                {starters.map((item, index) => (
                  <button key={item} onClick={() => submit(item)}>
                    <span>{index === 0 ? <Search/> : index === 1 ? <Sparkles/> : index === 2 ? <Globe2/> : <Monitor/>}</span>
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <article className={"message-row " + message.role} key={index}>
                  <div className="message-avatar">
                    {message.role === "assistant" ? <img src="/beetle.png" alt="Cybeetle"/> : firstName.slice(0,1).toUpperCase()}
                  </div>
                  <div className="message-content">
                    <strong>{message.role === "assistant" ? "Cybeetle" : "You"}</strong>
                    <p>{message.text}</p>
                  </div>
                </article>
              ))}
              {busy && (
                <div className="thinking">
                  <span/><span/><span/>
                  <small>{status}</small>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <form className="composer" onSubmit={onSubmit}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={mode === "Web" ? "Search or ask anything..." : mode === "AI" ? "Ask Cybeetle..." : "Describe a task for the browser agent..."}
              rows={1}
            />
            <div className="composer-tools">
              <div className="tool-left">
                <button type="button" aria-label="Attach file"><Plus size={18}/></button>
                <button type="button" aria-label="Attach context"><Paperclip size={17}/></button>
                <span className="mode-badge">{mode}<ChevronDown size={13}/></span>
              </div>
              <div className="tool-right">
                <button type="button" aria-label="Voice"><Mic size={17}/></button>
                {busy ? (
                  <button type="button" className="send stop" onClick={stop} aria-label="Stop"><span/></button>
                ) : (
                  <button type="submit" className="send" aria-label="Send"><ArrowUp size={18}/></button>
                )}
              </div>
            </div>
          </form>
          <p className="composer-note">
            Cybeetle can make mistakes. Review important information and sensitive actions.
          </p>
        </div>
      </section>
    </main>
  );
}

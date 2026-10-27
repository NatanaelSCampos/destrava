"use client";

import { useEffect, useState } from "react";
import { Mic, MessageCircle } from "lucide-react";
import { LiveConversation } from "@/components/conversation/live-conversation";
import { TextConversation } from "@/components/conversation/text-conversation";
import "./conversation-tabs.css";

export default function ConversationPage() {
  const [tab, setTab] = useState<"voice" | "text">("voice");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("session") && !params.has("scenario")) return;
    const timer = window.setTimeout(() => setTab("text"), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className="conversation-space">
    <nav className="conversation-mode-tabs" aria-label="Como conversar">
      <button type="button" aria-pressed={tab === "voice"} onClick={() => setTab("voice")}><Mic size={18} /><span>Por voz<small>Converse no seu ritmo</small></span></button>
      <button type="button" aria-pressed={tab === "text"} onClick={() => setTab("text")}><MessageCircle size={18} /><span>Por mensagens<small>Escreva e pratique</small></span></button>
    </nav>
    {tab === "voice" ? <LiveConversation /> : <TextConversation />}
  </div>;
}

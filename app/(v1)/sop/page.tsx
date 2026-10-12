"use client";
import { useEffect, useState, useCallback } from "react";
import { FileText, Calendar } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { SopTable } from "@/components/SopTable";

interface SopRow {
  id: number;
  columnName: string;
  description: string | null;
  allocatedTo: string | null;
  email: string | null;
  dailyLog: string | null;
  date: string | null;
  source: string | null;
  doneFromWhere: string | null;
  isManual: boolean;
  dailyLogEnabled: boolean;
  dateEnabled: boolean;
}
interface DailyLog { id:number; sopResponsibilityId:number; date:string; isChecked:boolean; checkedBy:string|null; checkedAt:string|null; }

function getIstToday(): string {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = ist.getFullYear(); const m = String(ist.getMonth()+1).padStart(2,"0"); const d = String(ist.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

export default function SopPage() {
  const { data: session, status } = useSession();
  const isAuthenticated = status==="authenticated";
  const [sopRows, setSopRows] = useState<SopRow[]>([]);
  const [logs, setLogs] = useState<Map<number, DailyLog>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string>(()=> getIstToday());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number|null>(null);

  const fetchSop = useCallback(async()=>{
    try{ const res=await fetch("/api/sop-responsibilities"); const data=await res.json(); if(data.success) setSopRows(data.data); } catch{ toast.error("Failed to load SOP"); }
  },[]);
  const fetchLogs = useCallback(async(dateStr:string)=>{
    try{ const res=await fetch(`/api/sop-daily-logs?date=${dateStr}`); const data=await res.json(); if(data.success){ const m=new Map<number,DailyLog>(); for(const l of data.data as DailyLog[]) m.set(l.sopResponsibilityId,l); setLogs(m);} } catch{ toast.error("Failed to load daily logs"); }
  },[]);

  useEffect(()=>{ (async()=>{ setLoading(true); await fetchSop(); await fetchLogs(selectedDate); setLoading(false); })(); },[]);
  useEffect(()=>{ fetchLogs(selectedDate); },[selectedDate, fetchLogs]);

  const handleToggle = async(sopId:number, cur:boolean)=>{
    if(!isAuthenticated){ toast.error("Please sign in to update daily log"); return; }
    if(sopRows.find(r=>r.id===sopId && !r.dailyLogEnabled)){ toast.error("DailyLog disabled for this column (AI/parse)"); return; }
    const next=!cur; const prev=logs.get(sopId);
    const optimistic:DailyLog={ id: prev?.id||0, sopResponsibilityId:sopId, date:selectedDate, isChecked:next, checkedBy: session?.user?.email || session?.user?.name || "you", checkedAt:new Date().toISOString()};
    setLogs(m=>{ const n=new Map(m); n.set(sopId, optimistic); return n; });
    setToggling(sopId);
    try{
      const res=await fetch("/api/sop-daily-logs/toggle",{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sopResponsibilityId:sopId, date:selectedDate, isChecked:next})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||"Toggle failed");
      setLogs(m=>{ const n=new Map(m); n.set(sopId, data.data); return n; });
      toast.success(next? "Marked done":"Unchecked");
    } catch(e:any){ setLogs(m=>{ const n=new Map(m); if(prev) n.set(sopId, prev); else n.delete(sopId); return n; }); toast.error(e.message||"Failed"); } finally{ setToggling(null); }
  };

  if(loading){
    return <div className="flex flex-1 flex-col p-6 gap-4" style={{paddingTop:"12px"}}><div className="flex items-center gap-2"><FileText className="size-5 text-brand-ink"/><h1 className="text-xl font-bold text-brand-ink">SOP</h1></div><p className="text-sm text-muted-foreground">Loading SOP...</p></div>
  }

  return (
    <div className="flex flex-1 flex-col p-6 gap-4 min-h-0" style={{paddingTop:"12px", height:"calc(100vh - 42px)", display:"flex"}}>
      <div className="flex items-center gap-2 shrink-0">
        <FileText className="size-5 text-brand-ink"/><h1 className="text-xl font-bold text-brand-ink">SOP</h1>
        <span className="text-xs text-muted-foreground">Roles & Responsibilities — Column Name | Description | Done From Where | Source | Manual? | Allocated | Daily Log (IST)</span>
      </div>

      <div className="flex items-center gap-2 text-xs shrink-0">
        <span className="flex items-center gap-1 text-muted-foreground"><Calendar size={14}/> IST Date:</span>
        <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-ink" />
        {!isAuthenticated && <span className="text-amber-600 dark:text-amber-300 ml-2">Sign in to tick daily logs</span>}
      </div>

      {sopRows.length===0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center shrink-0"><p className="text-sm text-muted-foreground">No SOP responsibilities configured.</p><p className="text-xs text-muted-foreground mt-1">Ask admin to seed via Admin→SOP or run scripts/seed-sop.ts</p></div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <SopTable rows={sopRows} dailyLogs={logs} selectedDate={selectedDate} onToggle={handleToggle} isAuthenticated={isAuthenticated} togglingId={toggling} />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground text-center shrink-0">Table: Headers sticky (vertical) + Column Name/Description sticky (horizontal) — resizer, dropdown filters.</p>
    </div>
  );
}

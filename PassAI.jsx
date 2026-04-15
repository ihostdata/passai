import { useState, useRef, useEffect } from "react";

const G = {
  green900: "#062914", green800: "#0a4a26", green700: "#0d6633",
  green600: "#108541", green500: "#14a050", green400: "#2bb968",
  green100: "#c8f0d8", green50: "#edfaf3",
  amber500: "#f5a623", amber400: "#f7bc55", amber100: "#fef3d8", amber50: "#fffbf0",
  cream: "#faf8f4", gray50: "#f6f5f2", gray100: "#eceae4",
  gray300: "#c4c1b8", gray500: "#8a877f", gray700: "#4a4843", gray900: "#1a1917",
  white: "#ffffff", danger: "#c0392b",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:${G.cream};color:${G.gray900};-webkit-font-smoothing:antialiased}
  .sora{font-family:'Sora',sans-serif}
  ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${G.gray50}}::-webkit-scrollbar-thumb{background:${G.green400};border-radius:3px}
  input,textarea,select{font-family:'DM Sans',sans-serif}
  button{cursor:pointer;font-family:'DM Sans',sans-serif}
  .fade-in{animation:fadeIn 0.4s ease}
  @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .spin{animation:spin 0.8s linear infinite;display:inline-block}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  .pulse{animation:pulse 1.5s ease infinite}
  @keyframes slideIn{from{transform:translateX(-20px);opacity:0}to{transform:translateX(0);opacity:1}}
  @media(max-width:768px){
    .hide-mobile{display:none!important}
    .mobile-full{width:100%!important}
    .mobile-stack{flex-direction:column!important}
    .mobile-p{padding:1rem!important}
  }
`;

const SUBJECTS = ["Mathematics","English Language","Physics","Chemistry","Biology","Economics","Government","Literature","Geography","CRS/IRS"];
const EXAMS = ["JAMB","WAEC","NECO","GCE"];
const SAMPLE_QUESTIONS = [
  {id:1,exam:"JAMB",year:2023,subject:"Mathematics",question:"If log₂(x+3) = 3, find x.",options:["5","3","8","6"],answer:0,explanation:"log₂(x+3)=3 means 2³=x+3, so 8=x+3, therefore x=5. Remember: logₐ(b)=c means aᶜ=b."},
  {id:2,exam:"WAEC",year:2022,subject:"Physics",question:"A body moves with uniform velocity. Which statement is correct?",options:["Net force acts on it","Acceleration is constant","Net force is zero","Momentum decreases"],answer:2,explanation:"Uniform velocity means no change in speed or direction. By Newton's 1st Law, if velocity is constant, net force = 0."},
  {id:3,exam:"JAMB",year:2023,subject:"Chemistry",question:"What is the oxidation state of Cr in K₂Cr₂O₇?",options:["+3","+6","+7","+4"],answer:1,explanation:"In K₂Cr₂O₇: K is +1 (×2=+2), O is -2 (×7=-14). So 2+2Cr-14=0 → 2Cr=12 → Cr=+6."},
  {id:4,exam:"WAEC",year:2023,subject:"English Language",question:"Choose the word that is closest in meaning to 'VERBOSE'.",options:["Silent","Wordy","Angry","Confused"],answer:1,explanation:"'Verbose' means using more words than needed — wordy or long-winded. Synonyms include: garrulous, loquacious, prolix."},
  {id:5,exam:"JAMB",year:2022,subject:"Biology",question:"The powerhouse of the cell is the:",options:["Nucleus","Ribosome","Mitochondrion","Golgi body"],answer:2,explanation:"Mitochondria produce ATP (energy) through cellular respiration, earning the name 'powerhouse of the cell'."},
  {id:6,exam:"NECO",year:2023,subject:"Economics",question:"Which of the following is NOT a factor of production?",options:["Land","Capital","Money","Labour"],answer:2,explanation:"The four factors of production are Land, Labour, Capital, and Entrepreneurship. Money is a medium of exchange, not a factor of production."},
];

const MOCK_PROGRESS = {streak:7,questionsToday:6,totalQuestions:248,accuracy:72,subjects:{Mathematics:68,Physics:81,Chemistry:75,Biology:65,"English Language":79}};

function Spinner({size=18,color=G.green500}){
  return <span className="spin" style={{width:size,height:size,borderRadius:"50%",border:`2px solid ${color}30`,borderTop:`2px solid ${color}`,display:"inline-block"}}/>
}

function Tag({children,color=G.green500,bg=G.green50}){
  return <span style={{background:bg,color,fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,letterSpacing:"0.03em"}}>{children}</span>
}

function Btn({children,onClick,variant="primary",size="md",loading,disabled,style={}}){
  const base={border:"none",borderRadius:10,fontWeight:600,cursor:disabled||loading?"not-allowed":"pointer",transition:"all 0.15s",display:"inline-flex",alignItems:"center",gap:6,opacity:disabled||loading?0.7:1,...style};
  const variants={
    primary:{background:G.green600,color:G.white,padding:size==="sm"?"8px 16px":"12px 24px",fontSize:size==="sm"?13:15},
    outline:{background:"transparent",color:G.green700,border:`1.5px solid ${G.green400}`,padding:size==="sm"?"7px 15px":"11px 23px",fontSize:size==="sm"?13:15},
    ghost:{background:"transparent",color:G.gray500,padding:size==="sm"?"6px 12px":"10px 20px",fontSize:size==="sm"?13:15},
    danger:{background:G.danger,color:G.white,padding:size==="sm"?"8px 16px":"12px 24px",fontSize:size==="sm"?13:15},
    amber:{background:G.amber500,color:G.white,padding:size==="sm"?"8px 16px":"12px 24px",fontSize:size==="sm"?13:15},
  };
  return <button onClick={onClick} disabled={disabled||loading} style={{...base,...variants[variant]}}>{loading?<Spinner size={14} color={variant==="outline"?G.green600:G.white}/>:null}{children}</button>;
}

function Card({children,style={},onClick,hover}){
  const [hovered,setHovered]=useState(false);
  return <div onMouseEnter={()=>hover&&setHovered(true)} onMouseLeave={()=>hover&&setHovered(false)} onClick={onClick}
    style={{background:G.white,borderRadius:16,border:`1px solid ${G.gray100}`,padding:"1.25rem",transition:"all 0.2s",
      boxShadow:hovered?"0 8px 24px rgba(10,74,38,0.1)":"0 2px 8px rgba(0,0,0,0.04)",cursor:onClick?"pointer":"default",...style}}>{children}</div>
}

function StatCard({label,value,icon,color=G.green600,bg=G.green50}){
  return <div style={{background:bg,borderRadius:14,padding:"1rem 1.25rem",display:"flex",alignItems:"center",gap:12}}>
    <div style={{width:42,height:42,borderRadius:12,background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{icon}</div>
    <div><div style={{fontSize:22,fontWeight:700,fontFamily:"Sora",color:G.gray900}}>{value}</div>
    <div style={{fontSize:12,color:G.gray500,fontWeight:500}}>{label}</div></div>
  </div>
}

function ProgressBar({value,max=100,color=G.green500}){
  return <div style={{height:8,background:G.gray100,borderRadius:4,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${(value/max)*100}%`,background:color,borderRadius:4,transition:"width 0.5s ease"}}/>
  </div>
}

function Avatar({name,size=36}){
  const initials=name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return <div style={{width:size,height:size,borderRadius:"50%",background:G.green800,color:G.white,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,fontFamily:"Sora",flexShrink:0}}>{initials}</div>
}

// ─── LANDING PAGE ────────────────────────────────────────────────────────────
function LandingPage({onAuth}){
  const [mode,setMode]=useState("login");
  const [form,setForm]=useState({name:"",email:"",password:"",exam:"JAMB"});
  const [loading,setLoading]=useState(false);

  const handleSubmit=async()=>{
    if(!form.email||!form.password)return;
    setLoading(true);
    await new Promise(r=>setTimeout(r,900));
    setLoading(false);
    onAuth({name:form.name||"Student",email:form.email,exam:form.exam,plan:"free"});
  };

  return <div style={{minHeight:"100vh",background:G.cream}}>
    {/* Hero */}
    <div style={{background:`linear-gradient(135deg, ${G.green900} 0%, ${G.green800} 50%, ${G.green700} 100%)`,padding:"0 1.5rem",position:"relative",overflow:"hidden"}}>
      {/* Decorative circles */}
      <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",border:`1px solid ${G.green600}40`}}/>
      <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",border:`1px solid ${G.green500}30`}}/>
      <div style={{position:"absolute",bottom:-100,left:-60,width:280,height:280,borderRadius:"50%",background:`${G.green600}20`}}/>
      
      <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1.2rem 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:G.amber500,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎯</div>
          <span className="sora" style={{color:G.white,fontWeight:800,fontSize:22,letterSpacing:"-0.5px"}}>PassAI</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="ghost" size="sm" onClick={()=>setMode("login")} style={{color:G.gray300}}>Login</Btn>
          <Btn variant="amber" size="sm" onClick={()=>setMode("signup")}>Get Started</Btn>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",gap:60,padding:"4rem 0 5rem",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:280}}>
          <Tag color={G.amber500} bg={`${G.amber500}20`}>🇳🇬 Nigeria's #1 AI Study Tool</Tag>
          <h1 className="sora" style={{color:G.white,fontSize:"clamp(2rem,5vw,3.2rem)",fontWeight:800,lineHeight:1.15,marginTop:16,marginBottom:20,letterSpacing:"-1px"}}>
            Pass JAMB, WAEC & NECO with <span style={{color:G.amber500}}>AI Power</span>
          </h1>
          <p style={{color:`${G.white}bb`,fontSize:17,lineHeight:1.7,marginBottom:28,maxWidth:480}}>
            Upload your textbooks, practice with 15,000+ past questions, and get step-by-step AI explanations tailored for Nigerian exam success.
          </p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Btn variant="amber" onClick={()=>{document.getElementById("auth-card").scrollIntoView({behavior:"smooth"})}}>Start for Free →</Btn>
            <Btn variant="outline" style={{borderColor:`${G.white}40`,color:G.white}} onClick={()=>setMode("login")}>See Demo</Btn>
          </div>
          <div style={{display:"flex",gap:24,marginTop:32,flexWrap:"wrap"}}>
            {[["15,000+","Past Questions"],["4.9★","Student Rating"],["98%","Pass Rate"]].map(([v,l])=>(
              <div key={l}><div className="sora" style={{color:G.amber400,fontWeight:700,fontSize:20}}>{v}</div>
              <div style={{color:`${G.white}80`,fontSize:12,marginTop:2}}>{l}</div></div>
            ))}
          </div>
        </div>

        {/* Auth Card */}
        <div id="auth-card" style={{width:"100%",maxWidth:380,background:G.white,borderRadius:20,padding:"2rem",boxShadow:"0 24px 60px rgba(0,0,0,0.25)"}}>
          <div style={{display:"flex",background:G.gray50,borderRadius:10,padding:4,marginBottom:20}}>
            {["login","signup"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px",border:"none",borderRadius:8,fontWeight:600,fontSize:13,background:mode===m?G.white:"transparent",color:mode===m?G.green700:G.gray500,transition:"all 0.2s",boxShadow:mode===m?"0 2px 6px rgba(0,0,0,0.08)":"none"}}>
                {m==="login"?"Log In":"Sign Up"}
              </button>
            ))}
          </div>
          {mode==="signup"&&<div style={{marginBottom:14}}>
            <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>Full Name</label>
            <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Chukwuemeka Obi" style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${G.gray100}`,borderRadius:10,fontSize:14,outline:"none"}}/>
          </div>}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>Email Address</label>
            <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" placeholder="you@example.com" style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${G.gray100}`,borderRadius:10,fontSize:14,outline:"none"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>Password</label>
            <input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} type="password" placeholder="••••••••" style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${G.gray100}`,borderRadius:10,fontSize:14,outline:"none"}}/>
          </div>
          {mode==="signup"&&<div style={{marginBottom:16}}>
            <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>Target Exam</label>
            <select value={form.exam} onChange={e=>setForm({...form,exam:e.target.value})} style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${G.gray100}`,borderRadius:10,fontSize:14,outline:"none",background:G.white}}>
              {EXAMS.map(e=><option key={e}>{e}</option>)}
            </select>
          </div>}
          <Btn onClick={handleSubmit} loading={loading} style={{width:"100%",justifyContent:"center",marginBottom:12}}>
            {mode==="login"?"Log In to PassAI":"Create Free Account"}
          </Btn>
          <p style={{fontSize:12,color:G.gray500,textAlign:"center"}}>{mode==="login"?"Don't have an account? ":"Already have an account? "}
            <span onClick={()=>setMode(mode==="login"?"signup":"login")} style={{color:G.green600,cursor:"pointer",fontWeight:600}}>{mode==="login"?"Sign Up":"Log In"}</span>
          </p>
        </div>
      </div>
    </div>

    {/* Features */}
    <div style={{maxWidth:1100,margin:"0 auto",padding:"4rem 1.5rem"}}>
      <div style={{textAlign:"center",marginBottom:"3rem"}}>
        <h2 className="sora" style={{fontSize:"clamp(1.5rem,3vw,2.2rem)",fontWeight:800,color:G.gray900,letterSpacing:"-0.5px"}}>Everything You Need to Pass</h2>
        <p style={{color:G.gray500,fontSize:16,marginTop:8}}>Built specifically for JAMB, WAEC, and NECO students</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:20}}>
        {[
          {icon:"📄",title:"PDF AI Tutor",desc:"Upload any textbook and ask questions in plain English. Get instant explanations."},
          {icon:"📝",title:"Past Questions",desc:"15,000+ verified JAMB, WAEC & NECO questions with detailed answers from 2000–2024."},
          {icon:"🤖",title:"AI Practice Tests",desc:"Generate custom tests by subject, topic, or difficulty. Get performance analytics."},
          {icon:"📊",title:"Progress Tracking",desc:"Monitor your accuracy per subject, study streak, and exam readiness score."},
          {icon:"📅",title:"Study Schedule",desc:"AI creates a personalized study plan based on your exam date and weak areas."},
          {icon:"💡",title:"Step-by-Step Solutions",desc:"Never just see an answer — understand every step with our AI explanations."},
        ].map(f=><Card key={f.title} hover>
          <div style={{fontSize:28,marginBottom:12}}>{f.icon}</div>
          <h3 className="sora" style={{fontWeight:700,fontSize:16,color:G.gray900,marginBottom:6}}>{f.title}</h3>
          <p style={{fontSize:14,color:G.gray500,lineHeight:1.6}}>{f.desc}</p>
        </Card>)}
      </div>
    </div>

    {/* Pricing */}
    <div style={{background:G.green900,padding:"4rem 1.5rem"}}>
      <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
        <h2 className="sora" style={{color:G.white,fontSize:"clamp(1.5rem,3vw,2rem)",fontWeight:800,marginBottom:8,letterSpacing:"-0.5px"}}>Simple, Affordable Pricing</h2>
        <p style={{color:`${G.white}70`,marginBottom:"2.5rem"}}>Start free. Upgrade when you're ready.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
          {[
            {name:"Free",price:"₦0",period:"forever",features:["10 questions/day","Basic AI Q&A","5 past question sets"],cta:"Get Started",v:"outline"},
            {name:"Basic",price:"₦4,000",period:"/month",features:["Unlimited questions","Full AI Tutor","All past questions","Progress tracking"],cta:"Start Basic",v:"primary",popular:true},
            {name:"Pro",price:"₦8,000",period:"/month",features:["Everything in Basic","Full past questions DB","Study schedule AI","Priority support"],cta:"Go Pro",v:"amber"},
          ].map(p=><div key={p.name} style={{background:p.popular?G.green700:G.green800,borderRadius:16,padding:"1.5rem",border:p.popular?`2px solid ${G.amber500}`:`1px solid ${G.green700}`,position:"relative"}}>
            {p.popular&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:G.amber500,color:G.white,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20}}>MOST POPULAR</div>}
            <div className="sora" style={{color:G.white,fontWeight:700,fontSize:16,marginBottom:4}}>{p.name}</div>
            <div style={{marginBottom:16}}><span className="sora" style={{color:G.amber400,fontWeight:800,fontSize:28}}>{p.price}</span><span style={{color:`${G.white}60`,fontSize:13}}>{p.period}</span></div>
            {p.features.map(f=><div key={f} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:13,color:`${G.white}cc`}}>
              <span style={{color:G.green400,fontWeight:700}}>✓</span>{f}
            </div>)}
            <Btn variant={p.v} onClick={()=>handleSubmit()} style={{width:"100%",justifyContent:"center",marginTop:16}}>{p.cta}</Btn>
          </div>)}
        </div>
      </div>
    </div>
  </div>
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard",icon:"⊞",label:"Dashboard"},
  {id:"ai-tutor",icon:"🤖",label:"AI Tutor"},
  {id:"past-questions",icon:"📚",label:"Past Questions"},
  {id:"practice-test",icon:"📝",label:"Practice Test"},
  {id:"schedule",icon:"📅",label:"Study Schedule"},
  {id:"progress",icon:"📊",label:"Progress"},
];

function Sidebar({active,onNav,user,onLogout}){
  return <div style={{width:220,background:G.green900,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,flexShrink:0}}>
    <div style={{padding:"1.25rem 1rem",borderBottom:`1px solid ${G.green800}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:32,height:32,borderRadius:9,background:G.amber500,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎯</div>
        <span className="sora" style={{color:G.white,fontWeight:800,fontSize:20,letterSpacing:"-0.5px"}}>PassAI</span>
      </div>
    </div>
    <nav style={{flex:1,padding:"0.75rem 0.5rem",overflowY:"auto"}}>
      {NAV.map(n=><button key={n.id} onClick={()=>onNav(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:"none",background:active===n.id?G.green700:"transparent",color:active===n.id?G.white:`${G.white}70`,cursor:"pointer",marginBottom:2,transition:"all 0.15s",fontSize:14,fontWeight:active===n.id?600:400}}>
        <span style={{fontSize:17,opacity:active===n.id?1:0.7}}>{n.icon}</span>{n.label}
      </button>)}
    </nav>
    <div style={{padding:"1rem",borderTop:`1px solid ${G.green800}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <Avatar name={user.name} size={32}/>
        <div style={{minWidth:0}}>
          <div style={{color:G.white,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
          <div style={{color:`${G.white}60`,fontSize:11}}>Free Plan</div>
        </div>
      </div>
      <button onClick={onLogout} style={{width:"100%",padding:"8px",border:`1px solid ${G.green700}`,borderRadius:8,background:"transparent",color:`${G.white}70`,fontSize:12,cursor:"pointer"}}>Sign Out</button>
    </div>
  </div>
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({user}){
  const prog=MOCK_PROGRESS;
  const todayDate=new Date().toLocaleDateString("en-NG",{weekday:"long",month:"long",day:"numeric"});
  return <div className="fade-in" style={{padding:"2rem"}}>
    <div style={{marginBottom:"1.5rem"}}>
      <h1 className="sora" style={{fontSize:26,fontWeight:800,color:G.gray900,letterSpacing:"-0.5px"}}>Good morning, {user.name.split(" ")[0]} 👋</h1>
      <p style={{color:G.gray500,fontSize:14,marginTop:4}}>{todayDate} · Keep the streak going!</p>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:"1.5rem"}}>
      <StatCard label="Day Streak 🔥" value={prog.streak} icon="🔥" color={G.amber500} bg={G.amber50}/>
      <StatCard label="Today's Questions" value={`${prog.questionsToday}/10`} icon="✅" color={G.green600} bg={G.green50}/>
      <StatCard label="Total Answered" value={prog.totalQuestions} icon="📝" color={"#6c5ce7"} bg="#f0eeff"/>
      <StatCard label="Avg. Accuracy" value={`${prog.accuracy}%`} icon="🎯" color={"#0984e3"} bg="#e6f5ff"}/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:"1.5rem"}} className="mobile-stack">
      <Card>
        <h3 className="sora" style={{fontWeight:700,fontSize:15,marginBottom:16,color:G.gray900}}>Subject Performance</h3>
        {Object.entries(prog.subjects).map(([sub,acc])=><div key={sub} style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:13,color:G.gray700,fontWeight:500}}>{sub}</span>
            <span style={{fontSize:13,fontWeight:700,color:acc>=75?G.green600:acc>=60?"#f39c12":G.danger}}>{acc}%</span>
          </div>
          <ProgressBar value={acc} color={acc>=75?G.green500:acc>=60?"#f39c12":G.danger}/>
        </div>)}
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Card style={{background:G.green50,border:`1px solid ${G.green100}`}}>
          <div style={{fontSize:28,marginBottom:8}}>🏆</div>
          <div className="sora" style={{fontWeight:800,fontSize:18,color:G.green700}}>Top Subject</div>
          <div style={{fontSize:24,fontWeight:700,color:G.green600}}>Physics</div>
          <div style={{fontSize:13,color:G.green700,marginTop:4}}>81% accuracy</div>
        </Card>
        <Card style={{background:G.amber50,border:`1px solid ${G.amber100}`}}>
          <div style={{fontSize:28,marginBottom:8}}>⚡</div>
          <div className="sora" style={{fontWeight:700,fontSize:14,color:G.gray700}}>Needs Work</div>
          <div style={{fontSize:18,fontWeight:700,color:G.amber500}}>Biology</div>
          <div style={{fontSize:13,color:G.gray500,marginTop:4}}>65% — practice more!</div>
        </Card>
      </div>
    </div>

    <Card>
      <h3 className="sora" style={{fontWeight:700,fontSize:15,marginBottom:14,color:G.gray900}}>🗓 Today's Study Plan</h3>
      {[{time:"08:00 AM",task:"Mathematics — Quadratic Equations",done:true},{time:"10:00 AM",task:"English Language — Comprehension",done:true},{time:"12:00 PM",task:"Chemistry — Mole Concept",done:false},{time:"03:00 PM",task:"JAMB Past Questions (2022)",done:false},{time:"05:00 PM",task:"Physics Mock Test",done:false}].map((t,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<4?`1px solid ${G.gray50}`:"none"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:t.done?G.green500:G.gray300,flexShrink:0}}/>
          <span style={{fontSize:12,color:G.gray400,width:80,flexShrink:0}}>{t.time}</span>
          <span style={{fontSize:14,color:t.done?G.gray400:G.gray900,textDecoration:t.done?"line-through":"none",flex:1}}>{t.task}</span>
          {t.done&&<Tag color={G.green600} bg={G.green50}>Done</Tag>}
        </div>
      ))}
    </Card>
  </div>
}

// ─── AI TUTOR ────────────────────────────────────────────────────────────────
function AITutor(){
  const [messages,setMessages]=useState([{role:"assistant",content:"Hello! I'm your PassAI tutor 🎯\n\nYou can:\n• Ask me any JAMB/WAEC topic question\n• Upload a PDF and ask questions about it\n• Request step-by-step explanations\n\nWhat would you like to study today?"}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [pdfName,setPdfName]=useState(null);
  const bottomRef=useRef();
  const fileRef=useRef();

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages]);

  const send=async(text=input)=>{
    if(!text.trim()||loading)return;
    const userMsg={role:"user",content:text};
    setMessages(prev=>[...prev,userMsg]);
    setInput("");setLoading(true);
    try{
      const history=[...messages,userMsg].map(m=>({role:m.role,content:m.content}));
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:1000,
          system:`You are PassAI — an expert tutor for Nigerian secondary school and university entrance exams (JAMB, WAEC, NECO, GCE). You specialize in Mathematics, English, Physics, Chemistry, Biology, Economics, and Government.\n\nAlways:\n- Give clear, concise explanations suited for Nigerian students\n- Use Nigerian curriculum context\n- Provide step-by-step workings for math/science problems\n- Reference relevant exam formats (JAMB UTM, WAEC essay format)\n- Be encouraging and supportive\n- Format answers with clear steps using numbered lists or bullet points\n- End with a quick tip or memory aid when helpful`,
          messages:history
        })
      });
      const data=await res.json();
      const reply=data.content?.[0]?.text||"Sorry, I couldn't generate a response. Please try again.";
      setMessages(prev=>[...prev,{role:"assistant",content:reply}]);
    }catch(e){
      setMessages(prev=>[...prev,{role:"assistant",content:"⚠️ Connection error. Please check your internet and try again."}]);
    }
    setLoading(false);
  };

  const handleFile=e=>{
    const f=e.target.files[0];
    if(f){setPdfName(f.name);send(`I've uploaded a PDF called "${f.name}". Please help me study it. Start by asking me what topic or chapter I want to focus on.`)}
  };

  const QUICK=[
    "Explain the mole concept in Chemistry",
    "Solve: 2x² - 5x + 3 = 0",
    "What are Newton's Laws of Motion?",
    "JAMB English: Active vs Passive voice",
  ];

  return <div className="fade-in" style={{padding:"2rem",height:"100%",display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <h1 className="sora" style={{fontSize:24,fontWeight:800,color:G.gray900,letterSpacing:"-0.5px"}}>AI Tutor 🤖</h1>
        <p style={{color:G.gray500,fontSize:14,marginTop:2}}>Ask anything. Get step-by-step answers.</p>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {pdfName&&<Tag color={G.green700} bg={G.green50}>📄 {pdfName.slice(0,20)}...</Tag>}
        <input ref={fileRef} type="file" accept=".pdf" style={{display:"none"}} onChange={handleFile}/>
        <Btn variant="outline" size="sm" onClick={()=>fileRef.current.click()}>📄 Upload PDF</Btn>
      </div>
    </div>

    {/* Messages */}
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:16,minHeight:0}}>
      {messages.map((m,i)=><div key={i} style={{display:"flex",gap:12,flexDirection:m.role==="user"?"row-reverse":"row",alignItems:"flex-start"}}>
        {m.role==="assistant"&&<div style={{width:34,height:34,borderRadius:10,background:G.green800,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🎯</div>}
        {m.role==="user"&&<Avatar name="You" size={34}/>}
        <div style={{maxWidth:"78%",background:m.role==="user"?G.green700:G.white,color:m.role==="user"?G.white:G.gray900,borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"12px 16px",fontSize:14,lineHeight:1.7,border:m.role==="assistant"?`1px solid ${G.gray100}`:"none",whiteSpace:"pre-wrap"}}>
          {m.content}
        </div>
      </div>)}
      {loading&&<div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        <div style={{width:34,height:34,borderRadius:10,background:G.green800,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎯</div>
        <div style={{background:G.white,border:`1px solid ${G.gray100}`,borderRadius:"16px 16px 16px 4px",padding:"12px 16px",display:"flex",gap:6,alignItems:"center"}}>
          {[0,1,2].map(i=><div key={i} className="pulse" style={{width:8,height:8,borderRadius:"50%",background:G.green400,animationDelay:`${i*0.2}s`}}/>)}
        </div>
      </div>}
      <div ref={bottomRef}/>
    </div>

    {/* Quick questions */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {QUICK.map(q=><button key={q} onClick={()=>send(q)} style={{fontSize:12,padding:"6px 12px",borderRadius:20,border:`1px solid ${G.green200||G.green100}`,background:G.green50,color:G.green700,cursor:"pointer",fontWeight:500}}>{q}</button>)}
    </div>

    {/* Input */}
    <div style={{display:"flex",gap:10,background:G.white,border:`1.5px solid ${G.gray100}`,borderRadius:14,padding:"8px 8px 8px 16px"}}>
      <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}}
        placeholder="Ask any exam question… e.g. 'Explain photosynthesis step by step'"
        style={{flex:1,border:"none",outline:"none",resize:"none",fontSize:14,lineHeight:1.5,fontFamily:"'DM Sans',sans-serif",color:G.gray900,background:"transparent",minHeight:40,maxHeight:120}}
        rows={1}/>
      <Btn onClick={()=>send()} disabled={!input.trim()||loading} loading={loading} style={{alignSelf:"flex-end",padding:"10px 16px"}}>Send ↑</Btn>
    </div>
  </div>
}

// ─── PAST QUESTIONS ───────────────────────────────────────────────────────────
function PastQuestions(){
  const [filter,setFilter]=useState({exam:"All",subject:"All",year:"All"});
  const [selected,setSelected]=useState(null);
  const [answered,setAnswered]=useState({});
  const [showExplain,setShowExplain]=useState({});
  const [aiExplain,setAiExplain]=useState({});
  const [loadingExplain,setLoadingExplain]=useState({});

  const years=["All","2023","2022","2021","2020"];
  const filtered=SAMPLE_QUESTIONS.filter(q=>(filter.exam==="All"||q.exam===filter.exam)&&(filter.subject==="All"||q.subject===filter.subject)&&(filter.year==="All"||q.year===parseInt(filter.year)));

  const getAIExplanation=async(q)=>{
    setLoadingExplain(p=>({...p,[q.id]:true}));
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,
          messages:[{role:"user",content:`For this ${q.exam} ${q.year} ${q.subject} question:\n\n"${q.question}"\n\nOptions: ${q.options.map((o,i)=>`${String.fromCharCode(65+i)}) ${o}`).join(", ")}\n\nThe correct answer is: ${q.options[q.answer]}\n\nProvide a detailed step-by-step explanation for Nigerian students, including: 1) Why the correct answer is right, 2) Why other options are wrong, 3) A quick memory tip. Keep it concise but thorough.`}]
        })
      });
      const data=await res.json();
      setAiExplain(p=>({...p,[q.id]:data.content?.[0]?.text||"Explanation unavailable."}));
    }catch(e){setAiExplain(p=>({...p,[q.id]:"Error loading explanation. Check connection."}))}
    setLoadingExplain(p=>({...p,[q.id]:false}));
    setShowExplain(p=>({...p,[q.id]:true}));
  };

  return <div className="fade-in" style={{padding:"2rem"}}>
    <div style={{marginBottom:"1.5rem"}}>
      <h1 className="sora" style={{fontSize:24,fontWeight:800,color:G.gray900,letterSpacing:"-0.5px"}}>Past Questions 📚</h1>
      <p style={{color:G.gray500,fontSize:14,marginTop:2}}>15,000+ verified questions from JAMB, WAEC, NECO (2000–2024)</p>
    </div>

    {/* Filters */}
    <Card style={{marginBottom:"1.25rem",padding:"1rem"}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        {[["Exam",["All",...EXAMS],"exam"],["Subject",["All",...SUBJECTS.slice(0,6)],"subject"],["Year",years,"year"]].map(([label,opts,key])=>(
          <div key={key}><label style={{fontSize:12,fontWeight:600,color:G.gray500,display:"block",marginBottom:4}}>{label}</label>
          <select value={filter[key]} onChange={e=>setFilter(p=>({...p,[key]:e.target.value}))} style={{padding:"8px 12px",border:`1.5px solid ${G.gray100}`,borderRadius:8,fontSize:13,outline:"none",background:G.white,color:G.gray900}}>
            {opts.map(o=><option key={o}>{o}</option>)}
          </select></div>
        ))}
        <div style={{marginLeft:"auto"}}>
          <Tag color={G.green700} bg={G.green50}>{filtered.length} questions</Tag>
        </div>
      </div>
    </Card>

    {filtered.map(q=>{
      const userAns=answered[q.id];
      const isCorrect=userAns===q.answer;
      return <Card key={q.id} style={{marginBottom:14}}>
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <Tag color={"#6c5ce7"} bg="#f0eeff">{q.exam}</Tag>
          <Tag color={G.green700} bg={G.green50}>{q.year}</Tag>
          <Tag color={G.gray700} bg={G.gray50}>{q.subject}</Tag>
        </div>
        <p style={{fontSize:15,color:G.gray900,fontWeight:500,marginBottom:14,lineHeight:1.6}}>{q.question}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {q.options.map((opt,i)=>{
            let bg=G.white,border=`1.5px solid ${G.gray100}`,color=G.gray900;
            if(userAns!==undefined){
              if(i===q.answer){bg=G.green50;border=`1.5px solid ${G.green400}`;color=G.green700}
              else if(i===userAns&&!isCorrect){bg="#fff0f0";border=`1.5px solid ${G.danger}`;color:G.danger}
            }
            return <button key={i} onClick={()=>{if(userAns===undefined)setAnswered(p=>({...p,[q.id]:i}))}}
              style={{padding:"10px 14px",border,borderRadius:10,background:bg,color,cursor:userAns===undefined?"pointer":"default",textAlign:"left",fontSize:13,fontWeight:500,transition:"all 0.2s"}}>
              <span style={{fontWeight:700,marginRight:6}}>{String.fromCharCode(65+i)}.</span>{opt}
            </button>
          })}
        </div>
        {userAns!==undefined&&<div style={{marginTop:12}}>
          <div style={{padding:"10px 14px",borderRadius:10,background:isCorrect?G.green50:"#fff0f0",border:`1px solid ${isCorrect?G.green100:"#fdd"}`,fontSize:13,color:isCorrect?G.green700:G.danger,fontWeight:600,marginBottom:8}}>
            {isCorrect?"✅ Correct! Well done!":"❌ Incorrect. The answer is "+q.options[q.answer]}
          </div>
          {!showExplain[q.id]&&<Btn variant="outline" size="sm" loading={loadingExplain[q.id]} onClick={()=>getAIExplanation(q)}>🤖 Get AI Explanation</Btn>}
          {showExplain[q.id]&&<div style={{background:G.amber50,border:`1px solid ${G.amber100}`,borderRadius:10,padding:"12px 14px",fontSize:13,lineHeight:1.7,color:G.gray700,whiteSpace:"pre-wrap"}}>{aiExplain[q.id]||q.explanation}</div>}
        </div>}
      </Card>
    })}
  </div>
}

// ─── PRACTICE TEST ────────────────────────────────────────────────────────────
function PracticeTest(){
  const [config,setConfig]=useState({subject:"Mathematics",count:5,difficulty:"Mixed",exam:"JAMB"});
  const [phase,setPhase]=useState("setup");
  const [questions,setQuestions]=useState([]);
  const [answers,setAnswers]=useState({});
  const [loading,setLoading]=useState(false);
  const [current,setCurrent]=useState(0);
  const [showResults,setShowResults]=useState(false);
  const [aiQuestions,setAiQuestions]=useState([]);

  const generateTest=async()=>{
    setLoading(true);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,
          messages:[{role:"user",content:`Generate exactly ${config.count} ${config.difficulty} difficulty ${config.exam} style multiple choice questions on "${config.subject}" for Nigerian secondary school students.\n\nReturn ONLY valid JSON array, no markdown, no explanation:\n[\n  {\n    "question": "question text",\n    "options": ["A option","B option","C option","D option"],\n    "answer": 0,\n    "explanation": "clear explanation of why answer is correct"\n  }\n]\n\nMake questions authentic to ${config.exam} style and Nigerian curriculum. Answer index is 0-based.`}]
        })
      });
      const data=await res.json();
      let text=data.content?.[0]?.text||"[]";
      text=text.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const parsed=JSON.parse(text);
      setAiQuestions(parsed);
      setPhase("test");
      setCurrent(0);
      setAnswers({});
      setShowResults(false);
    }catch(e){
      alert("Error generating test. Please try again.");
    }
    setLoading(false);
  };

  const finish=()=>setShowResults(true);
  const score=Object.entries(answers).filter(([i,a])=>aiQuestions[parseInt(i)]?.answer===a).length;

  if(phase==="setup") return <div className="fade-in" style={{padding:"2rem",maxWidth:600}}>
    <h1 className="sora" style={{fontSize:24,fontWeight:800,color:G.gray900,letterSpacing:"-0.5px",marginBottom:4}}>Practice Test 📝</h1>
    <p style={{color:G.gray500,fontSize:14,marginBottom:"1.5rem"}}>AI generates fresh questions tailored to your needs</p>
    <Card>
      <h3 className="sora" style={{fontWeight:700,marginBottom:16,color:G.gray900}}>Configure Your Test</h3>
      {[["Exam Type",EXAMS,"exam"],["Subject",SUBJECTS,"subject"]].map(([label,opts,key])=>(
        <div key={key} style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>{label}</label>
          <select value={config[key]} onChange={e=>setConfig(p=>({...p,[key]:e.target.value}))} style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${G.gray100}`,borderRadius:10,fontSize:14,outline:"none",background:G.white}}>
            {opts.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
      ))}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>Number of Questions: {config.count}</label>
        <input type="range" min={5} max={20} step={5} value={config.count} onChange={e=>setConfig(p=>({...p,count:parseInt(e.target.value)}))} style={{width:"100%"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:G.gray400,marginTop:4}}>
          {[5,10,15,20].map(v=><span key={v}>{v}</span>)}
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:8}}>Difficulty</label>
        <div style={{display:"flex",gap:8}}>
          {["Easy","Mixed","Hard"].map(d=><button key={d} onClick={()=>setConfig(p=>({...p,difficulty:d}))} style={{flex:1,padding:"10px",border:`1.5px solid ${config.difficulty===d?G.green400:G.gray100}`,borderRadius:10,background:config.difficulty===d?G.green50:G.white,color:config.difficulty===d?G.green700:G.gray500,fontWeight:600,fontSize:13,cursor:"pointer",transition:"all 0.15s"}}>{d}</button>)}
        </div>
      </div>
      <Btn onClick={generateTest} loading={loading} style={{width:"100%",justifyContent:"center"}}>🤖 Generate AI Test</Btn>
    </Card>
  </div>

  if(showResults) return <div className="fade-in" style={{padding:"2rem",maxWidth:700}}>
    <Card style={{textAlign:"center",marginBottom:16,background:`linear-gradient(135deg,${G.green50},${G.amber50})`}}>
      <div style={{fontSize:56,marginBottom:8}}>{score/aiQuestions.length>=0.8?"🏆":score/aiQuestions.length>=0.6?"👍":"📚"}</div>
      <h2 className="sora" style={{fontSize:28,fontWeight:800,color:G.gray900}}>{score}/{aiQuestions.length} Correct</h2>
      <div style={{fontSize:32,fontWeight:800,color:score/aiQuestions.length>=0.8?G.green600:G.amber500,marginBottom:8}}>{Math.round((score/aiQuestions.length)*100)}%</div>
      <p style={{color:G.gray500,fontSize:14}}>{score/aiQuestions.length>=0.8?"Excellent! Keep it up 🔥":score/aiQuestions.length>=0.6?"Good effort! Review wrong answers":"Keep practising — you'll get there!"}</p>
      <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:16}}>
        <Btn onClick={()=>setPhase("setup")} variant="outline">New Test</Btn>
        <Btn onClick={()=>setShowResults(false)}>Review Answers</Btn>
      </div>
    </Card>
    {aiQuestions.map((q,i)=><Card key={i} style={{marginBottom:10,borderLeft:`4px solid ${answers[i]===q.answer?G.green500:G.danger}`}}>
      <div style={{fontSize:14,fontWeight:600,color:G.gray900,marginBottom:8}}>Q{i+1}. {q.question}</div>
      <div style={{fontSize:13,color:answers[i]===q.answer?G.green700:G.danger,marginBottom:6}}>{answers[i]===q.answer?"✅":"❌"} Your answer: {q.options[answers[i]]||"Not answered"}</div>
      {answers[i]!==q.answer&&<div style={{fontSize:13,color:G.green700,marginBottom:6}}>✅ Correct: {q.options[q.answer]}</div>}
      <div style={{fontSize:13,color:G.gray500,background:G.gray50,padding:"8px 12px",borderRadius:8}}>{q.explanation}</div>
    </Card>)}
  </div>

  const q=aiQuestions[current];
  const total=aiQuestions.length;
  return <div className="fade-in" style={{padding:"2rem",maxWidth:680}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div><h2 className="sora" style={{fontSize:18,fontWeight:700,color:G.gray900}}>{config.subject} · {config.exam}</h2>
      <p style={{fontSize:13,color:G.gray500,marginTop:2}}>Question {current+1} of {total}</p></div>
      <Btn variant="outline" size="sm" onClick={finish}>Finish & Review</Btn>
    </div>
    <ProgressBar value={current+1} max={total} color={G.green500}/>
    <Card style={{marginTop:16,marginBottom:16}}>
      <div style={{fontSize:16,fontWeight:600,color:G.gray900,lineHeight:1.7,marginBottom:18}}>{q.question}</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {q.options.map((opt,i)=><button key={i} onClick={()=>{setAnswers(p=>({...p,[current]:i}));if(current<total-1)setTimeout(()=>setCurrent(c=>c+1),400);else setShowResults(true)}}
          style={{padding:"12px 16px",border:`1.5px solid ${answers[current]===i?G.green400:G.gray100}`,borderRadius:10,background:answers[current]===i?G.green50:G.white,color:answers[current]===i?G.green700:G.gray900,cursor:"pointer",textAlign:"left",fontSize:14,fontWeight:500,transition:"all 0.15s"}}>
          <span style={{fontWeight:700,marginRight:8,color:G.gray400}}>{String.fromCharCode(65+i)}.</span>{opt}
        </button>)}
      </div>
    </Card>
    <div style={{display:"flex",gap:10}}>
      <Btn variant="outline" disabled={current===0} onClick={()=>setCurrent(c=>c-1)}>← Prev</Btn>
      <Btn disabled={current===total-1} onClick={()=>setCurrent(c=>c+1)}>Next →</Btn>
    </div>
  </div>
}

// ─── STUDY SCHEDULE ───────────────────────────────────────────────────────────
function StudySchedule(){
  const [form,setForm]=useState({exam:"JAMB",date:"",hoursPerDay:3,weakSubjects:[],strongSubjects:[]});
  const [schedule,setSchedule]=useState(null);
  const [loading,setLoading]=useState(false);

  const toggleSub=(list,sub)=>{
    setForm(p=>({...p,[list]:p[list].includes(sub)?p[list].filter(s=>s!==sub):[...p[list],sub]}));
  };

  const generate=async()=>{
    if(!form.date){alert("Please select your exam date");return}
    setLoading(true);
    const daysLeft=Math.ceil((new Date(form.date)-new Date())/(1000*60*60*24));
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,
          messages:[{role:"user",content:`Create a ${daysLeft}-day study schedule for a Nigerian student preparing for ${form.exam} on ${form.date}.\n\nDetails:\n- Available hours per day: ${form.hoursPerDay}\n- Weak subjects needing more time: ${form.weakSubjects.join(", ")||"none specified"}\n- Strong subjects: ${form.strongSubjects.join(", ")||"none specified"}\n\nReturn ONLY valid JSON, no markdown:\n{\n  "overview": "2-3 sentence strategy summary",\n  "phases": [\n    {\n      "name": "Phase name",\n      "duration": "X weeks",\n      "focus": "main goal",\n      "daily": [\n        {"time":"08:00","task":"Subject — Topic","duration":"1hr"}\n      ]\n    }\n  ],\n  "tips": ["tip1","tip2","tip3"]\n}`}]
        })
      });
      const data=await res.json();
      let text=data.content?.[0]?.text||"{}";
      text=text.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      setSchedule(JSON.parse(text));
    }catch(e){alert("Error generating schedule. Please try again.")}
    setLoading(false);
  };

  return <div className="fade-in" style={{padding:"2rem"}}>
    <h1 className="sora" style={{fontSize:24,fontWeight:800,color:G.gray900,letterSpacing:"-0.5px",marginBottom:4}}>Study Schedule 📅</h1>
    <p style={{color:G.gray500,fontSize:14,marginBottom:"1.5rem"}}>AI creates a personalized plan based on your exam date</p>
    <div style={{display:"grid",gridTemplateColumns:schedule?"1fr 1.5fr":"1fr",gap:20,maxWidth:schedule?1000:550}}>
      <Card>
        <h3 className="sora" style={{fontWeight:700,marginBottom:16,color:G.gray900}}>Your Details</h3>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>Target Exam</label>
          <select value={form.exam} onChange={e=>setForm(p=>({...p,exam:e.target.value}))} style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${G.gray100}`,borderRadius:10,fontSize:14,outline:"none",background:G.white}}>
            {EXAMS.map(e=><option key={e}>{e}</option>)}
          </select>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>Exam Date</label>
          <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${G.gray100}`,borderRadius:10,fontSize:14,outline:"none"}}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:6}}>Study Hours/Day: {form.hoursPerDay}h</label>
          <input type="range" min={1} max={10} value={form.hoursPerDay} onChange={e=>setForm(p=>({...p,hoursPerDay:parseInt(e.target.value)}))} style={{width:"100%"}}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.gray700,display:"block",marginBottom:8}}>Weak Subjects</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {SUBJECTS.slice(0,8).map(s=><button key={s} onClick={()=>toggleSub("weakSubjects",s)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${form.weakSubjects.includes(s)?G.danger:"#eee"}`,background:form.weakSubjects.includes(s)?"#fff0f0":G.white,color:form.weakSubjects.includes(s)?G.danger:G.gray500,fontSize:12,cursor:"pointer",fontWeight:500}}>{s}</button>)}
          </div>
        </div>
        <Btn onClick={generate} loading={loading} style={{width:"100%",justifyContent:"center"}}>🤖 Generate Schedule</Btn>
      </Card>

      {schedule&&<div className="fade-in">
        <Card style={{marginBottom:14,background:G.green50,border:`1px solid ${G.green100}`}}>
          <h3 className="sora" style={{fontWeight:700,marginBottom:8,color:G.green800}}>📋 Strategy Overview</h3>
          <p style={{fontSize:14,color:G.green700,lineHeight:1.7}}>{schedule.overview}</p>
        </Card>
        {schedule.phases?.map((phase,i)=><Card key={i} style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:28,height:28,borderRadius:8,background:G.green800,color:G.white,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13}}>{i+1}</div>
            <div><div className="sora" style={{fontWeight:700,color:G.gray900,fontSize:15}}>{phase.name}</div>
            <div style={{fontSize:12,color:G.gray500}}>{phase.duration} · {phase.focus}</div></div>
          </div>
          {phase.daily?.map((item,j)=><div key={j} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:j<phase.daily.length-1?`1px solid ${G.gray50}`:"none",alignItems:"center"}}>
            <span style={{fontSize:12,color:G.gray400,width:55,flexShrink:0}}>{item.time}</span>
            <span style={{fontSize:13,color:G.gray900,flex:1}}>{item.task}</span>
            <Tag color={G.green700} bg={G.green50}>{item.duration}</Tag>
          </div>)}
        </Card>)}
        {schedule.tips&&<Card style={{background:G.amber50,border:`1px solid ${G.amber100}`}}>
          <h3 className="sora" style={{fontWeight:700,marginBottom:10,color:G.amber500}}>💡 Pro Tips</h3>
          {schedule.tips.map((t,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:8,fontSize:13,color:G.gray700}}>
            <span style={{color:G.amber500,fontWeight:700,flexShrink:0}}>→</span>{t}
          </div>)}
        </Card>}
      </div>}
    </div>
  </div>
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
function Progress(){
  const prog=MOCK_PROGRESS;
  return <div className="fade-in" style={{padding:"2rem"}}>
    <h1 className="sora" style={{fontSize:24,fontWeight:800,color:G.gray900,letterSpacing:"-0.5px",marginBottom:4}}>Progress 📊</h1>
    <p style={{color:G.gray500,fontSize:14,marginBottom:"1.5rem"}}>Track your journey to exam success</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:"1.5rem"}}>
      <StatCard label="Day Streak" value={`${prog.streak} 🔥`} icon="🔥" color={G.amber500} bg={G.amber50}/>
      <StatCard label="Total Questions" value={prog.totalQuestions} icon="📝" color={G.green600} bg={G.green50}/>
      <StatCard label="Overall Accuracy" value={`${prog.accuracy}%`} icon="🎯" color={"#0984e3"} bg="#e6f5ff"/>
      <StatCard label="Exams Ready" value="72%" icon="🏆" color={"#6c5ce7"} bg="#f0eeff"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}} className="mobile-stack">
      <Card>
        <h3 className="sora" style={{fontWeight:700,fontSize:15,marginBottom:16,color:G.gray900}}>Subject Breakdown</h3>
        {Object.entries(prog.subjects).map(([sub,acc])=><div key={sub} style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:13,color:G.gray700,fontWeight:500}}>{sub}</span>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:acc>=75?G.green600:acc>=60?"#f39c12":G.danger}}>{acc}%</span>
              <Tag color={acc>=75?G.green700:acc>=60?"#b7770d":G.danger} bg={acc>=75?G.green50:acc>=60?G.amber50:"#fff0f0"}>{acc>=75?"Strong":acc>=60?"Good":"Weak"}</Tag>
            </div>
          </div>
          <ProgressBar value={acc} color={acc>=75?G.green500:acc>=60?"#f39c12":G.danger}/>
        </div>)}
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Card style={{background:`linear-gradient(135deg,${G.green800},${G.green700})`,border:"none"}}>
          <div style={{fontSize:13,color:`${G.white}80`,fontWeight:600,marginBottom:4}}>EXAM READINESS</div>
          <div style={{fontSize:48,fontWeight:800,fontFamily:"Sora",color:G.white,lineHeight:1}}>72%</div>
          <ProgressBar value={72} color={G.amber500}/>
          <div style={{fontSize:12,color:`${G.white}70`,marginTop:8}}>You need 80% to be exam ready</div>
        </Card>
        <Card>
          <h3 className="sora" style={{fontWeight:700,fontSize:14,marginBottom:12,color:G.gray900}}>📅 Weekly Activity</h3>
          <div style={{display:"flex",gap:6,alignItems:"flex-end",height:60}}>
            {[20,35,28,45,60,40,55].map((h,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{width:"100%",background:i===6?G.green500:G.green100,borderRadius:4,height:h}}/>
              <span style={{fontSize:10,color:G.gray400}}>{"SMTWTFS"[i]}</span>
            </div>)}
          </div>
        </Card>
        <Card style={{background:G.amber50,border:`1px solid ${G.amber100}`}}>
          <h3 style={{fontWeight:700,fontSize:14,marginBottom:8,color:G.gray900}}>📌 Focus Areas</h3>
          {["Biology — Genetics","Mathematics — Integration","Economics — Elasticity"].map(s=><div key={s} style={{display:"flex",gap:8,marginBottom:6,fontSize:13,color:G.gray700}}>
            <span style={{color:G.amber500}}>→</span>{s}
          </div>)}
        </Card>
      </div>
    </div>
  </div>
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(null);
  const [view,setView]=useState("dashboard");
  const [sidebarOpen,setSidebarOpen]=useState(false);

  if(!user) return <><style>{css}</style><LandingPage onAuth={setUser}/></>

  const views={
    dashboard:<Dashboard user={user}/>,
    "ai-tutor":<AITutor/>,
    "past-questions":<PastQuestions/>,
    "practice-test":<PracticeTest/>,
    schedule:<StudySchedule/>,
    progress:<Progress/>,
  };

  return <><style>{css}</style>
    <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
      {/* Mobile header */}
      <div className="hide-desktop" style={{position:"fixed",top:0,left:0,right:0,height:56,background:G.green900,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1rem",zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:G.amber500,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎯</div>
          <span className="sora" style={{color:G.white,fontWeight:800,fontSize:18}}>PassAI</span>
        </div>
        <button onClick={()=>setSidebarOpen(p=>!p)} style={{background:"transparent",border:"none",color:G.white,fontSize:20,cursor:"pointer"}}>☰</button>
      </div>
      <div className="hide-mobile"><Sidebar active={view} onNav={v=>{setView(v);setSidebarOpen(false)}} user={user} onLogout={()=>setUser(null)}/></div>
      <main style={{flex:1,overflowY:"auto",background:G.cream}}>
        {views[view]||<Dashboard user={user}/>}
      </main>
    </div>
  </>
}

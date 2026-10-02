const STORAGE_KEY = "smartStudyPlanner_v1";

const state = {
  subjects: JSON.parse(localStorage.getItem(STORAGE_KEY + "_subjects") || "[]"),
  tasks: JSON.parse(localStorage.getItem(STORAGE_KEY + "_tasks") || "[]"),
  currentSection: "dashboard"
};

let subjectChart = null;
let overallChart = null;

const $ = id => document.getElementById(id);
const todayISO = () => new Date().toISOString().slice(0,10);

function save() {
  localStorage.setItem(STORAGE_KEY + "_subjects", JSON.stringify(state.subjects));
  localStorage.setItem(STORAGE_KEY + "_tasks", JSON.stringify(state.tasks));
}

function uid(prefix="id") {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
}

function dateObj(s) {
  const d = new Date(s + "T00:00:00");
  return isNaN(d) ? new Date() : d;
}

function formatDate(s, opts={day:"numeric", month:"short"}) {
  return dateObj(s).toLocaleDateString("en-IN", opts);
}

function daysUntil(s) {
  const a = new Date(todayISO() + "T00:00:00");
  const b = dateObj(s);
  return Math.ceil((b-a)/86400000);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function difficultyName(n) {
  return n == 3 ? "Hard" : n == 2 ? "Medium" : "Easy";
}

function showAlert(message, error=false) {
  const box = $("alertBox");
  box.textContent = message;
  box.className = "alert" + (error ? " error" : "");
  clearTimeout(showAlert.timer);
  showAlert.timer = setTimeout(() => box.classList.add("hidden"), 3500);
}

function navigate(section) {
  state.currentSection = section;
  document.querySelectorAll(".section").forEach(s => s.classList.toggle("active", s.id === section));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.section === section));
  document.querySelectorAll(".mobile-footer button").forEach(b => b.classList.toggle("active", b.dataset.section === section));
  const titles = {dashboard:"Your Study Dashboard", subjects:"Your Subjects", planner:"Smart Revision Plan", progress:"Progress Analytics"};
  $("pageTitle").textContent = titles[section];
  if(section === "dashboard") renderDashboard();
  if(section === "subjects") renderSubjects();
  if(section === "planner") renderPlanner();
  if(section === "progress") renderProgress();
  window.scrollTo({top:0, behavior:"smooth"});
}

function openModal(subject=null) {
  $("subjectModal").classList.remove("hidden");
  $("modalTitle").textContent = subject ? "Edit Subject" : "Add Subject";
  $("subjectId").value = subject?.id || "";
  $("subjectName").value = subject?.name || "";
  $("examDate").value = subject?.examDate || "";
  $("difficulty").value = subject?.difficulty || "2";
  $("targetHours").value = subject?.targetHours || 5;
  const min = todayISO();
  $("examDate").min = min;
}

function closeModal() {
  $("subjectModal").classList.add("hidden");
  $("subjectForm").reset();
  $("subjectId").value = "";
}

function handleSubjectSubmit(e) {
  e.preventDefault();
  const name = $("subjectName").value.trim();
  const examDate = $("examDate").value;
  const difficulty = Number($("difficulty").value);
  const targetHours = Number($("targetHours").value);
  if(!name || !examDate || targetHours <= 0) return;

  const id = $("subjectId").value;
  if(id) {
    const s = state.subjects.find(x => x.id === id);
    if(s) Object.assign(s, {name, examDate, difficulty, targetHours});
  } else {
    state.subjects.push({id:uid("sub"), name, examDate, difficulty, targetHours});
  }
  save();
  closeModal();
  renderAll();
  showAlert(id ? "Subject updated successfully." : "Subject added successfully.");
}

function deleteSubject(id) {
  if(!confirm("Delete this subject and its scheduled tasks?")) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  state.tasks = state.tasks.filter(t => t.subjectId !== id);
  save(); renderAll(); showAlert("Subject deleted.");
}

function generatePlan() {
  if(!state.subjects.length) {
    showAlert("Add at least one subject before generating a plan.", true);
    navigate("subjects"); return;
  }

  const valid = state.subjects.filter(s => daysUntil(s.examDate) >= 0 && Number(s.targetHours) > 0);
  if(!valid.length) {
    showAlert("Your exam dates have already passed. Update the dates first.", true);
    navigate("subjects"); return;
  }

  // Preserve completed status for matching subject/date.
  const completedMap = new Map();
  state.tasks.forEach(t => completedMap.set(`${t.subjectId}|${t.date}`, t.completed));

  const maxDays = Math.max(...valid.map(s => Math.max(1, daysUntil(s.examDate))));
  const dailyHours = 4; // default hackathon planner capacity
  const newTasks = [];
  const remainingHours = Object.fromEntries(valid.map(s => [s.id, Number(s.targetHours)]));

  // Build sessions day by day. Priority = difficulty + deadline urgency.
  for(let offset=0; offset<=maxDays; offset++) {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()+offset);
    const iso = d.toISOString().slice(0,10);
    const available = valid.filter(s => dateObj(s.examDate) >= d && remainingHours[s.id] > 0);
    let capacity = dailyHours;

    available.sort((a,b) => {
      const ua = Math.max(0, daysUntil(a.examDate) - offset);
      const ub = Math.max(0, daysUntil(b.examDate) - offset);
      const scoreA = a.difficulty * 3 + 12 / (ua + 1);
      const scoreB = b.difficulty * 3 + 12 / (ub + 1);
      return scoreB - scoreA;
    });

    for(const s of available) {
      if(capacity <= 0) break;
      const urgency = Math.max(1, daysUntil(s.examDate) - offset + 1);
      let session = Math.min(1, remainingHours[s.id], capacity);
      if(urgency <= 2) session = Math.min(1.5, remainingHours[s.id], capacity);
      session = Math.round(session * 2) / 2;
      if(session <= 0) continue;

      newTasks.push({
        id: uid("task"),
        subjectId: s.id,
        date: iso,
        hours: session,
        completed: Boolean(completedMap.get(`${s.id}|${iso}`))
      });
      remainingHours[s.id] = Math.max(0, remainingHours[s.id] - session);
      capacity = Math.max(0, capacity - session);
    }
  }

  // If some hours remain, fill any valid pre-exam dates with one extra session.
  valid.forEach(s => {
    let guard=0;
    while(remainingHours[s.id] > 0 && guard++ < 100) {
      const candidates = [];
      for(let i=0;i<=daysUntil(s.examDate);i++) {
        const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+i);
        candidates.push(d.toISOString().slice(0,10));
      }
      const date = candidates[guard % candidates.length];
      const hours = Math.min(.5, remainingHours[s.id]);
      newTasks.push({id:uid("task"),subjectId:s.id,date,hours,completed:false});
      remainingHours[s.id] -= hours;
    }
  });

  state.tasks = newTasks.sort((a,b)=>a.date.localeCompare(b.date));
  save();
  renderAll();
  navigate("planner");
  showAlert("Your personalized study plan has been generated.");
}

function toggleTask(id, completed) {
  const t = state.tasks.find(x => x.id === id);
  if(t) t.completed = completed;
  save(); renderAll();
}

function renderDashboard() {
  const totalHours = state.tasks.reduce((a,t)=>a+Number(t.hours),0);
  const completed = state.tasks.filter(t=>t.completed).length;
  const completion = state.tasks.length ? Math.round(completed/state.tasks.length*100) : 0;
  $("statSubjects").textContent = state.subjects.length;
  $("statExams").textContent = state.subjects.filter(s=>daysUntil(s.examDate)>=0).length;
  $("statHours").textContent = `${Math.round(totalHours*10)/10}h`;
  $("statCompletion").textContent = completion + "%";
  $("todayDate").textContent = new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
  $("heroDay").textContent = String(new Date().getDate()).padStart(2,"0");

  const todays = state.tasks.filter(t=>t.date===todayISO());
  const taskBox = $("todayTasks");
  taskBox.innerHTML = todays.length ? todays.map(taskHTML).join("") :
    `<div class="empty-state" style="padding:25px;margin:0"><p>No tasks today. Generate a plan or enjoy your free time.</p></div>`;

  const exams = [...state.subjects].filter(s=>daysUntil(s.examDate)>=0).sort((a,b)=>a.examDate.localeCompare(b.examDate)).slice(0,5);
  $("countdownList").innerHTML = exams.length ? exams.map(s=>{
    const d=daysUntil(s.examDate);
    return `<div class="countdown-item"><div class="date-box">${formatDate(s.examDate,{day:"numeric",month:"short"})}</div><div><strong>${escapeHTML(s.name)}</strong><small>${d===0?"Exam today":d===1?"1 day remaining":d+" days remaining"}</small></div></div>`;
  }).join("") : `<p style="color:var(--muted);font-size:11px">No upcoming exams.</p>`;
}

function taskHTML(t) {
  const s=state.subjects.find(x=>x.id===t.subjectId);
  if(!s) return "";
  return `<label class="task ${t.completed?"completed":""}">
    <input type="checkbox" data-task="${t.id}" ${t.completed?"checked":""}>
    <div class="task-main"><strong>${escapeHTML(s.name)}</strong><small>Revision session · ${difficultyName(s.difficulty)}</small></div>
    <span class="duration">${t.hours}h</span>
  </label>`;
}

function renderSubjects() {
  const box=$("subjectCards"), empty=$("emptySubjects");
  empty.classList.toggle("hidden", state.subjects.length>0);
  box.innerHTML=state.subjects.map(s=>{
    const tasks=state.tasks.filter(t=>t.subjectId===s.id);
    const done=tasks.filter(t=>t.completed).length;
    const pct=tasks.length?Math.round(done/tasks.length*100):0;
    const diff=difficultyName(s.difficulty).toLowerCase();
    return `<article class="subject-card">
      <div class="subject-top"><h4>${escapeHTML(s.name)}</h4><div class="subject-actions"><button class="icon-btn" data-edit="${s.id}">Edit</button><button class="icon-btn" data-delete="${s.id}">Delete</button></div></div>
      <div class="subject-meta"><span class="pill ${diff}">${difficultyName(s.difficulty)}</span><span class="pill">Exam: ${formatDate(s.examDate)}</span><span class="pill">${s.targetHours}h target</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="subject-foot"><span>Plan progress</span><strong>${pct}%</strong></div>
    </article>`;
  }).join("");
}

function renderPlanner() {
  const totalHours=state.tasks.reduce((a,t)=>a+Number(t.hours),0);
  $("dailyCapacity").textContent="4h";
  $("plannedSessions").textContent=state.tasks.length;
  $("planEnd").textContent=state.tasks.length ? formatDate(state.tasks[state.tasks.length-1].date,{day:"numeric",month:"short",year:"numeric"}) : "—";
  $("emptyPlan").classList.toggle("hidden", state.tasks.length>0);
  const groups={};
  state.tasks.forEach(t=>(groups[t.date]??=[]).push(t));
  $("planDays").innerHTML=Object.entries(groups).map(([date,tasks])=>{
    const total=tasks.reduce((a,t)=>a+Number(t.hours),0);
    return `<div class="day-card"><div class="day-head"><strong>${formatDate(date,{weekday:"long",day:"numeric",month:"long"})}</strong><span>${total}h planned</span></div><div class="day-tasks">${tasks.map(t=>{
      const s=state.subjects.find(x=>x.id===t.subjectId); if(!s)return "";
      return `<label class="day-task"><input type="checkbox" data-task="${t.id}" ${t.completed?"checked":""}><div class="task-info"><strong>${escapeHTML(s.name)}</strong><small>Revision · ${difficultyName(s.difficulty)} · Exam ${formatDate(s.examDate)}</small></div><em>${t.hours}h</em></label>`;
    }).join("")}</div></div>`;
  }).join("");
}

function renderProgress() {
  const labels=state.subjects.map(s=>s.name);
  const values=state.subjects.map(s=>{
    const ts=state.tasks.filter(t=>t.subjectId===s.id); return ts.length?Math.round(ts.filter(t=>t.completed).length/ts.length*100):0;
  });
  if(subjectChart) subjectChart.destroy();
  subjectChart=new Chart($("subjectChart"),{type:"bar",data:{labels,datasets:[{label:"Completion %",data:values,borderWidth:0,borderRadius:6}]},options:{responsive:true,scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+"%"}}},plugins:{legend:{display:false}}}});
  const done=state.tasks.filter(t=>t.completed).length, remaining=state.tasks.length-done;
  if(overallChart) overallChart.destroy();
  overallChart=new Chart($("overallChart"),{type:"doughnut",data:{labels:["Completed","Remaining"],datasets:[{data:[done,remaining],borderWidth:0}]},options:{responsive:true,cutout:"72%",plugins:{legend:{position:"bottom"}}}});
  $("progressRows").innerHTML=state.subjects.length?state.subjects.map((s,i)=>`<div class="progress-row"><div class="progress-row-head"><strong>${escapeHTML(s.name)}</strong><span>${values[i]}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${values[i]}%"></div></div></div>`).join(""):`<p style="color:var(--muted);font-size:12px">Add subjects to see analytics.</p>`;
}

function renderAll(){renderDashboard();renderSubjects();renderPlanner();if(state.currentSection==="progress")renderProgress();}

function loadDemo() {
  const now=new Date(); now.setHours(0,0,0,0);
  const plus=n=>{const d=new Date(now);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
  state.subjects=[
    {id:"demo_dbms",name:"Database Management Systems",examDate:plus(4),difficulty:3,targetHours:5},
    {id:"demo_python",name:"Python Programming",examDate:plus(7),difficulty:2,targetHours:4},
    {id:"demo_stats",name:"Probability & Statistics",examDate:plus(10),difficulty:3,targetHours:5},
    {id:"demo_physics",name:"Engineering Physics",examDate:plus(13),difficulty:1,targetHours:3}
  ];
  state.tasks=[]; save(); generatePlan();
}

function resetAll() {
  if(!confirm("Delete all subjects and study plans?")) return;
  state.subjects=[];state.tasks=[];save();renderAll();navigate("dashboard");showAlert("All data has been reset.");
}

document.addEventListener("click", e=>{
  const nav=e.target.closest("[data-section]"); if(nav){navigate(nav.dataset.section);return}
  const go=e.target.closest("[data-go]"); if(go){navigate(go.dataset.go);return}
  if(e.target.matches("[data-task]")) toggleTask(e.target.dataset.task,e.target.checked);
  const edit=e.target.closest("[data-edit]"); if(edit){const s=state.subjects.find(x=>x.id===edit.dataset.edit);openModal(s)}
  const del=e.target.closest("[data-delete]"); if(del)deleteSubject(del.dataset.delete);
});

$("subjectForm").addEventListener("submit",handleSubjectSubmit);
$("closeModal").addEventListener("click",closeModal);
$("cancelModal").addEventListener("click",closeModal);
$("subjectModal").addEventListener("click",e=>{if(e.target.id==="subjectModal")closeModal()});
$("addSubjectTop").addEventListener("click",()=>openModal());
$("addSubjectBtn").addEventListener("click",()=>openModal());
$("emptyAdd").addEventListener("click",()=>openModal());
$("generateBtn").addEventListener("click",generatePlan);
$("demoBtn").addEventListener("click",loadDemo);
$("resetBtn").addEventListener("click",resetAll);

function init(){
  $("greeting").textContent = new Date().getHours()<12 ? "GOOD MORNING" : new Date().getHours()<18 ? "GOOD AFTERNOON" : "GOOD EVENING";
  navigate("dashboard");
}
init();

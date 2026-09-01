
const games = [
  {sport:"Vôlei", icon:"🏐", title:"Vôlei Masculino", opponent:"UFSC", time:"14:30", place:"Ginásio 2"},
  {sport:"Futsal", icon:"⚽", title:"Futsal Masculino", opponent:"UNIVILLE", time:"17:00", place:"Quadra 1"},
  {sport:"Basquete", icon:"🏀", title:"Basquete Masculino", opponent:"UNOESC", time:"19:30", place:"Ginásio 3"},
  {sport:"Handebol", icon:"🤾", title:"Handebol Masculino", opponent:"IFC", time:"09:00", place:"Ginásio 1"}
];

function goTo(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.screen === id));
  window.scrollTo({top:0, behavior:"smooth"});
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => goTo(btn.dataset.screen));
});

function renderGames(filter="Todos"){
  const el = document.getElementById("gamesList");
  const filtered = filter === "Todos" ? games : games.filter(g => g.sport === filter);
  el.innerHTML = filtered.map(g => `
    <article class="game-card">
      <span class="game-icon">${g.icon}</span>
      <div class="grow">
        <strong>${g.title}</strong>
        <small>UDESC × ${g.opponent}</small>
      </div>
      <div class="right">
        <strong>${g.time}</strong>
        <small>${g.place}</small>
      </div>
    </article>`).join("");
}
renderGames();

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    renderGames(chip.dataset.filter);
  });
});

const saved = JSON.parse(localStorage.getItem("cctSports") || "[]");
if(saved.length){
  document.querySelectorAll('.profile-card input[type="checkbox"]').forEach(cb => {
    cb.checked = saved.includes(cb.value);
  });
}
document.getElementById("saveSports").addEventListener("click", () => {
  const selected = [...document.querySelectorAll('.profile-card input:checked')].map(x=>x.value);
  localStorage.setItem("cctSports", JSON.stringify(selected));
  document.getElementById("savedMsg").textContent = "Preferências salvas neste celular ✓";
  setTimeout(()=>document.getElementById("savedMsg").textContent="",2500);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function go(screen){
  $$('.screen').forEach(x=>x.classList.toggle('active',x.dataset.screen===screen));
  $$('.bottom-nav button[data-go]').forEach(x=>x.classList.toggle('active',x.dataset.go===screen));
  closeDrawer();
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));

const drawer=$('#drawer'), backdrop=$('#drawerBackdrop');
function openDrawer(){drawer.classList.add('open');backdrop.classList.add('open')}
function closeDrawer(){drawer.classList.remove('open');backdrop.classList.remove('open')}
$('#menuBtn').onclick=openDrawer; $('#closeDrawer').onclick=closeDrawer; backdrop.onclick=closeDrawer;

const modal=$('#modal'), mc=$('#modalContent');
const modalData={
  scenario:`<span class="chip live">VÔLEI MASCULINO • GRUPO A</span><h2>🎯 O que a CCT precisa?</h2>
  <div class="modal-list"><div><strong>🟢 Vitória por 2×0</strong><small>Classificação garantida para a próxima fase.</small></div>
  <div><strong>🟡 Vitória por 2×1</strong><small>A classificação pode depender do resultado de Engenharia × Direito.</small></div>
  <div><strong>🔴 Derrota</strong><small>O cenário fica desfavorável e depende dos demais resultados.</small></div></div>
  <h3>IMPORTANTE</h3><p>Este conteúdo é demonstrativo. Na versão real, os cenários serão calculados conforme o regulamento oficial de cada competição e modalidade.</p>`,
  media:`<span class="chip">MÍDIA CCT</span><h2>Fotos e vídeos</h2><div class="modal-list"><div><strong>📸 Fotos da competição</strong><small>Abrir álbum no Google Drive</small></div><div><strong>🎥 Vídeos</strong><small>Melhores momentos e conteúdos da CCT</small></div><div><strong>🖼️ Galeria</strong><small>Registros de jogos, torcida e eventos</small></div></div>`,
  docs:`<span class="chip">DOCUMENTOS</span><h2>Central de arquivos</h2><div class="modal-list"><div><strong>Regulamento Interlaje 2026</strong><small>Abrir documento</small></div><div><strong>Tabela oficial</strong><small>Abrir arquivo</small></div><div><strong>Caderno de jogos</strong><small>Abrir arquivo</small></div></div>`,
  places:`<span class="chip">LOCAIS</span><h2>Onde precisamos estar?</h2><div class="modal-list"><div><strong>📍 Ginásio Central</strong><small>Abrir no mapa</small></div><div><strong>📍 Salinha da Atlética</strong><small>UDESC Joinville</small></div><div><strong>📍 Local do evento</strong><small>Abrir no mapa</small></div></div>`,
  about:`<span class="chip">ATLÉTICA CCT</span><h2>Sobre a Atlética</h2><p>Área reservada para história, identidade, mascote, conquistas, títulos e informações institucionais da Atlética CCT.</p>`,
  partners:`<span class="chip">PARCEIROS</span><h2>Quem fortalece a CCT</h2><p>Espaço para logos, benefícios e links de parceiros e patrocinadores.</p>`,
  contacts:`<span class="chip">CONTATOS</span><h2>Fale com a CCT</h2><div class="modal-list"><div><strong>WhatsApp</strong><small>Contato oficial</small></div><div><strong>Instagram</strong><small>Rede social da Atlética</small></div><div><strong>Organização</strong><small>Contatos importantes durante a competição</small></div></div>`,
  help:`<span class="chip">AJUDA</span><h2>Como usar o app</h2><p>Aqui teremos instruções de instalação, uso do perfil, notificações e dúvidas frequentes.</p>`,
  forms:`<span class="chip">FORMULÁRIOS</span><h2>Pedidos e Vendas</h2><p>O aplicativo funcionará como uma central de acesso aos Google Forms usados pela Atlética.</p><div class="modal-list"><div><strong>🛍️ Produtos da Atlética</strong><small>Abrir Forms de pedido/venda</small></div><div><strong>🎽 Kits de atletas</strong><small>Abrir Forms da campanha ativa</small></div><div><strong>👕 Uniformes</strong><small>Abrir Forms de encomenda</small></div><div><strong>📦 Retiradas</strong><small>Abrir Forms de controle interno</small></div></div>`
};
function openModal(type){ mc.innerHTML=modalData[type]||modalData.help; modal.classList.add('open'); closeDrawer(); }
$$('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.open)));
$('#modalClose').onclick=()=>modal.classList.remove('open');
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
$('#alertBtn').onclick=()=>{mc.innerHTML=`<span class="chip live">2 NOVOS</span><h2>🔔 Avisos</h2><div class="modal-list"><div><strong>Futsal Masculino alterado</strong><small>Novo horário: hoje, 19:30.</small></div><div><strong>Interlaje 2026</strong><small>Tabela de jogos atualizada.</small></div></div>`;modal.classList.add('open')};

setTimeout(()=>$('#splash').classList.add('hide'),1500);
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}

const memberBtn=document.querySelector('#demoMemberAccess');
if(memberBtn){
  memberBtn.addEventListener('click',()=>{
    document.querySelector('#memberLock').hidden=true;
    document.querySelector('#memberDashboard').hidden=false;
  });
}

(function(){const KEY='cctProfileV2',sports=[...document.querySelectorAll('#sportGrid input[data-sport]')],count=document.getElementById('sportsCount'),summary=document.getElementById('profileSummary'),name=document.getElementById('profileNameDisplay'),feedback=document.getElementById('saveFeedback');const selected=()=>sports.filter(x=>x.checked).map(x=>x.dataset.sport);function update(){const n=selected().length;if(count)count.textContent=`${n} ${n===1?'selecionada':'selecionadas'}`;if(summary)summary.textContent=n?`${n} ${n===1?'modalidade selecionada':'modalidades selecionadas'}`:'Escolha suas modalidades'}function save(){const p={name:name?.textContent?.trim()||'Guilherme',sports:selected()};['onlyMySports','notifyUrgent','notifyGames','notifyEvents'].forEach(k=>p[k]=!!document.getElementById(k)?.checked);localStorage.setItem(KEY,JSON.stringify(p));update();if(feedback){feedback.classList.add('show');setTimeout(()=>feedback.classList.remove('show'),2200)}}try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(p){if(p.name&&name)name.textContent=p.name;sports.forEach(x=>x.checked=(p.sports||[]).includes(x.dataset.sport));['onlyMySports','notifyUrgent','notifyGames','notifyEvents'].forEach(k=>{const e=document.getElementById(k);if(e&&typeof p[k]==='boolean')e.checked=p[k]})}}catch(e){}sports.forEach(x=>x.addEventListener('change',update));document.getElementById('saveProfileBtn')?.addEventListener('click',save);document.getElementById('editProfileBtn')?.addEventListener('click',()=>{const v=prompt('Como você quer aparecer no app?',name?.textContent||'Guilherme');if(v&&v.trim()){name.textContent=v.trim();save()}});update()})();

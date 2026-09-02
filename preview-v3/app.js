const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const API_URL = 'https://script.google.com/macros/s/AKfycbwanjoMA8Kd9pdtGWlraMN7agGTdlY_8zMaXBQQQL_7zRBPwZltu8oVMfUQFHgAQOKzbA/exec';

let apiData = {
  jogos: [],
  classificacao: [],
  cenarios: []
};

async function carregarDadosAPI() {
  try {
    const resposta = await fetch(API_URL);
    const dados = await resposta.json();

    apiData.jogos = dados.jogos || [];
    apiData.classificacao = dados.classificacao || [];
    apiData.cenarios = dados.cenarios || [];

    console.log('API CCT carregada:', apiData);
  } catch (erro) {
    console.error('Erro ao carregar API CCT:', erro);
  }
}
carregarDadosAPI();
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

/* Eventos via Painel Administrativo (Google Sheets / Apps Script) */
const EVENTS_API='https://script.google.com/macros/s/AKfycbwanjoMA8Kd9pdtGWlraMN7agGTdlY_8zMaXBQQQL_7zRBPwZltu8oVMfUQFHgAQOKzbA/exec';
let cctEvents=[];
function eventDateValue(e){const p=(e.DATA||'').split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0],...(e.HORA||'00:00').split(':').map(Number)).getTime():Number.MAX_SAFE_INTEGER}
function eventMeta(e){return [e.DATA,e.HORA,e.LOCAL].filter(Boolean).join(' • ')}
function normalizeImageUrl(url){
  const raw=String(url||'').trim();
  if(!raw)return '';

  // Link comum do Google Drive: /file/d/ID/view...
  const driveFile=raw.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if(driveFile)return `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveFile[1])}=w1600`;

  // Outros links do Drive que usam ?id=ID
  try{
    const u=new URL(raw);
    if(/(^|\.)drive\.google\.com$/i.test(u.hostname)){
      const id=u.searchParams.get('id');
      if(id)return `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1600`;
    }
  }catch(e){}

  return raw;
}
function eventCard(e,home=false){const img=normalizeImageUrl(e.IMAGEM_URL)||'assets/evento-verde.jpg';const badge=e.DESTAQUE==='SIM'?'DESTAQUE':(e.STATUS||e.TIPO||'EVENTO');return `<article class="event-card ${home?'':'large'} dynamic-event" style="--event:url('${img.replace(/'/g,"%27")}')"><div class="event-gradient"></div><div class="event-copy"><span class="chip ${e.DESTAQUE==='SIM'?'live':''}">${badge}</span><h4>${escapeHtml(e.NOME||'Evento CCT')}</h4><p>${escapeHtml(eventMeta(e))}</p>${e.AVISO?`<small class="event-alert">${escapeHtml(e.AVISO)}</small>`:''}<button class="light" data-event-id="${escapeHtml(e.ID_EVENTO||'')}">VER DETALHES ›</button></div></article>`}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showEventDetails(id){const e=cctEvents.find(x=>x.ID_EVENTO===id);if(!e)return;const body=document.getElementById('modalContent');if(!body)return;body.innerHTML=`<span class="chip live">${escapeHtml(e.STATUS||e.TIPO||'EVENTO')}</span><h2>${escapeHtml(e.NOME)}</h2>${normalizeImageUrl(e.IMAGEM_URL)?`<img class="event-modal-image" src="${escapeHtml(normalizeImageUrl(e.IMAGEM_URL))}" alt="${escapeHtml(e.NOME)}">`:''}<div class="event-detail-list"><div><b>📅 Data</b><span>${escapeHtml(e.DATA)}${e.DATA_FIM?` até ${escapeHtml(e.DATA_FIM)}`:''}</span></div><div><b>🕒 Horário</b><span>${escapeHtml(e.HORA)}${e.HORA_FIM?` às ${escapeHtml(e.HORA_FIM)}`:''}</span></div><div><b>📍 Local</b><span>${escapeHtml(e.LOCAL)}${e.ENDERECO?`<small>${escapeHtml(e.ENDERECO)}</small>`:''}</span></div></div>${e.DESCRICAO?`<p>${escapeHtml(e.DESCRICAO)}</p>`:''}${e.AVISO?`<div class="event-notice">${escapeHtml(e.AVISO)}</div>`:''}<div class="event-actions">${e.LINK_MAPS?`<a class="ghost event-action" href="${escapeHtml(e.LINK_MAPS)}" target="_blank" rel="noopener">ABRIR MAPA</a>`:''}${e.LINK_COMPRA?`<a class="primary event-action" href="${escapeHtml(e.LINK_COMPRA)}" target="_blank" rel="noopener">${escapeHtml(e.TEXTO_BOTAO||'SAIBA MAIS')}</a>`:''}</div>`;document.getElementById('modal')?.classList.add('open')}
function bindEventButtons(){document.querySelectorAll('[data-event-id]').forEach(b=>b.addEventListener('click',()=>showEventDetails(b.dataset.eventId)))}
async function loadCctEvents(){const all=document.getElementById('eventsContainer'),home=document.getElementById('homeEventContainer');try{const r=await fetch(EVENTS_API,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();if(!data.sucesso)throw new Error(data.erro||'API');cctEvents=(data.eventos||[]).sort((a,b)=>(Number(a.ORDEM)||999)-(Number(b.ORDEM)||999)||eventDateValue(a)-eventDateValue(b));if(all)all.innerHTML=cctEvents.length?cctEvents.map(e=>eventCard(e)).join(''):'<div class="event-empty">Nenhum evento publicado no momento.</div>';const featured=cctEvents.find(e=>e.DESTAQUE==='SIM')||cctEvents[0];if(home)home.innerHTML=featured?eventCard(featured,true):'<div class="event-empty">Novos eventos em breve.</div>';bindEventButtons()}catch(err){console.error('Eventos:',err);const msg='<div class="event-error">Não foi possível atualizar os eventos agora.<small>Tente novamente em instantes.</small></div>';if(all)all.innerHTML=msg;if(home)home.innerHTML=msg}}
loadCctEvents();

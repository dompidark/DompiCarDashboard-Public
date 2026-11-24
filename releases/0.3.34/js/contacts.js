import { localStore } from './local-store.js';
import { phoneUrl } from './core.js';
import { parseVCard } from "./vcard.js";
export function initializeContacts(notice) {
  const phone = document.querySelector('#phone .phone-panel') || document.querySelector('#phone .panel');
  const host = document.createElement('section');
  host.className = 'contacts-panel';
  host.innerHTML = '<h3>Rubrica del dispositivo</h3><p>Su iPad importa un file vCard (.vcf) esportato da Contatti. Le copie restano in questo browser.</p><div class="filter-row"><button type="button" id="contacts-pick">Seleziona contatti</button><label class="file-picker" for="contacts-file">Importa vCard</label><input id="contacts-file" type="file" accept=".vcf,text/vcard" hidden></div><label>Cerca contatto<input id="contacts-search" type="search" placeholder="Nome o numero"></label><p id="contacts-status" role="status"></p><div id="contacts-list"></div><button type="button" id="contacts-clear">Elimina rubrica importata</button>';
  (phone || document.querySelector('#phone')).append(host);
  let contacts = [];
  const $ = id => document.getElementById(id);
  function render() {
    const query = $('contacts-search').value.toLocaleLowerCase('it');
    const filtered = contacts.filter(c => (c.name+' '+c.tel.join(' ')).toLocaleLowerCase('it').includes(query));
    $('contacts-list').replaceChildren();
    for (const contact of filtered.slice(0, 50)) for (const tel of contact.tel) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = `${contact.name || 'Contatto'} · ${tel}`;
      b.onclick = () => { $('phone-number').value = tel; $('phone-number').scrollIntoView({block:'nearest'}); };
      $('contacts-list').append(b);
    }
    $('contacts-status').textContent = `${contacts.length} contatti salvati. ${filtered.length > 50 ? 'Mostrati i primi 50: usa la ricerca.' : 'Tocca un numero e poi Apri Telefono.'}`;
  }
  async function add(incoming) {
    const merged = new Map(contacts.map(c=>[c.name+'|'+c.tel.join(','),c]));
    for (const c of incoming) {
      const safe = {name:String(c.name||'').slice(0,120),tel:(c.tel||[]).filter(t=>phoneUrl(t)).slice(0,10)};
      if (safe.tel.length) merged.set(safe.name+'|'+safe.tel.join(','),safe);
    }
    const next = [...merged.values()].slice(0,1000);
    await localStore.put('meta',{id:'contacts',contacts:next});
    contacts=next;render();
  }
  $('contacts-file').onchange = async event => {
    const file = event.target.files[0];
    try {
      if (!file) return;
      if (file.size > 2*1024*1024) throw Error('File troppo grande: massimo 2 MB.');
      const incoming = parseVCard(await file.text());
      if (!incoming.length) throw Error('Nessun numero valido trovato nel file vCard.');
      await add(incoming);
    } catch(error) { notice(error.message || 'Importazione non disponibile.'); }
    finally { event.target.value=''; }
  };
  $('contacts-pick').hidden = !navigator.contacts?.select;
  $('contacts-pick').onclick = async () => {
    try {
      const chosen=await navigator.contacts.select(['name','tel'],{multiple:true});
      await add(chosen.map(c=>({name:(c.name||[]).join(' '),tel:c.tel||[]})));
    } catch(error) { if(error.name!=='AbortError') notice('Accesso ai contatti non disponibile: usa Importa vCard.'); }
  };
  $('contacts-search').oninput=render;
  $('contacts-clear').onclick=async()=>{
    if(!confirm('Eliminare solo la copia dei contatti importati nella Dashboard?'))return;
    try { await localStore.remove('meta','contacts');contacts=[];render(); }
    catch {notice('Eliminazione non riuscita. Riprova.');}
  };
  const ready=localStore.get('meta','contacts').then(saved=>{contacts=Array.isArray(saved?.contacts)?saved.contacts:[];render();}).catch(()=>notice('Rubrica locale non disponibile.'));
  $('contacts-file').disabled=true;
  ready.finally(()=>{$('contacts-file').disabled=false;});
}

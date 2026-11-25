# Dompi Car Dashboard — versione pubblica 0.3.34

Interfaccia PWA per tablet in automobile, sviluppata da Domenico Pizzata.

**Progetto originale:** conservato privatamente. Questa è una copia di distribuzione senza la cronologia di sviluppo.

**Versione online prevista:** https://dompidark.github.io/DompiCarDashboard-Public/

## Come iniziare e installare Dompi Car Dashboard

### Uso online consigliato

Apri la versione pubblica direttamente dal browser:

**https://dompidark.github.io/DompiCarDashboard-Public/**

È il modo più semplice per provare Dompi Car Dashboard senza copiare file sul dispositivo.

### Aggiunta alla schermata Home dell’iPad

1. Apri l’indirizzo della Dashboard con Safari.
2. Tocca **Condividi**, quindi **Aggiungi alla schermata Home**.
3. Conferma e avvia Dompi dalla nuova icona nella schermata Home.

I nomi e la posizione dei comandi possono cambiare in base alla versione di iPadOS. La disponibilità della modalità PWA dipende dal browser e dal sistema operativo.

### Installazione avanzata su un proprio server

Lo ZIP della versione 0.3.34 è disponibile nella [pagina della release](https://github.com/dompidark/DompiCarDashboard-Public/releases/tag/v0.3.34). Nella sezione **Assets**, scarica il pacchetto della release indicato per Aruba o per un server web; gli archivi automatici **Source code** di GitHub non sono il pacchetto pronto per la pubblicazione.

Lo ZIP serve per copiare la Dashboard su un proprio spazio web **HTTPS**: non è un programma da installare con un doppio clic. Aprire `index.html` direttamente dal file system non abilita tutte le funzioni della PWA, del Service Worker e della cache offline.

### Guida iPad: Dompi in Slide Over

Slide Over consente di tenere Dompi in una finestra stretta accanto a un’app di navigazione. Prima di iniziare, apri **Impostazioni → Multitasking e gesti** e verifica che sia attiva la modalità **App a finestre**. Le denominazioni possono variare in base alla versione di iPadOS.

<p align="center">
  <a href="docs/installazione/01-controlli-finestra.jpeg">
    <img src="docs/installazione/01-controlli-finestra.jpeg" width="720" alt="Controlli della finestra di Dompi Car Dashboard nell’angolo superiore sinistro su iPad">
  </a><br>
  <sub><strong>1. Apri i controlli della finestra.</strong> Avvia Dompi dalla schermata Home, quindi tieni premuti i controlli della finestra o i pallini colorati in alto a sinistra finché compare il menu di disposizione.</sub>
</p>

<p align="center">
  <a href="docs/installazione/02-menu-avvia-slide-over.jpeg">
    <img src="docs/installazione/02-menu-avvia-slide-over.jpeg" width="720" alt="Menu di disposizione di iPadOS con il comando Avvia Slide Over">
  </a><br>
  <sub><strong>2. Seleziona Avvia Slide Over.</strong> Tocca la voce <em>Avvia Slide Over</em> nel menu di disposizione di iPadOS.</sub>
</p>

<p align="center">
  <a href="docs/installazione/03-dashboard-slide-over-destra.jpeg">
    <img src="docs/installazione/03-dashboard-slide-over-destra.jpeg" width="720" alt="Dompi Car Dashboard in una finestra Slide Over posizionata sul lato destro dell’iPad">
  </a><br>
  <sub><strong>3. Posiziona Dompi a destra.</strong> Apri l’app di navigazione sul lato sinistro e regola manualmente la posizione delle due finestre.</sub>
</p>

> Slide Over è una funzione del sistema operativo e dipende dal modello di iPad e dalla versione di iPadOS. Dompi non è CarPlay, non incorpora nativamente Waze, Google Maps o Mappe Apple e non può forzare la disposizione delle finestre di iPadOS. Configura la Dashboard e interagisci con i comandi soltanto a veicolo fermo.

<!-- gallery:start -->
<h2 id="dompi-car-dashboard-in-azione">Dompi Car Dashboard in azione</h2>

<p>Dompi Car Dashboard è una PWA pensata per iPad, che consente di affiancare le app di navigazione a un lettore musicale con radio Internet, file locali e libreria Jellyfin. Le immagini mostrano l’interfaccia e un esempio di installazione reale in auto.</p>

<p align="center">
  <a href="docs/gallery/01-installazione-auto.webp">
    <img src="docs/gallery/01-installazione-auto.webp" width="900" alt="iPad installato sul cruscotto con app di navigazione e Dompi Car Dashboard affiancate">
  </a><br>
  <sub><strong>Installazione reale in auto.</strong> iPad montato sul cruscotto, con navigazione e lettore affiancati. Foto di una versione precedente.</sub>
</p>

<blockquote>
  <p>Le mappe sono applicazioni esterne affiancate tramite le funzioni disponibili nel sistema operativo: Dompi non incorpora le app native e non è un’integrazione ufficiale CarPlay. Le aree cartografiche nelle fotografie sono state sfocate per tutelare la privacy.</p>
</blockquote>

<h3>Interfaccia e funzioni</h3>

<p>Seleziona una miniatura per aprire la fotografia a piena risoluzione.</p>

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/gallery/02-musica-locale.webp"><img src="docs/gallery/02-musica-locale-thumb.webp" width="420" alt="Musica locale affiancata alla navigazione con contatore e spettro audio"></a><br>
      <strong>Musica locale e navigazione</strong><br>
      <sub>Riproduzione di file locali, contatore dei brani e spettro audio.</sub>
    </td>
    <td width="50%" valign="top">
      <a href="docs/gallery/03-scelta-mappe.webp"><img src="docs/gallery/03-scelta-mappe-thumb.webp" width="420" alt="Menu di scelta tra Waze, Google Maps e Mappe Apple"></a><br>
      <strong>Scelta delle mappe</strong><br>
      <sub>Accesso rapido a Waze, Google Maps e Mappe Apple.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/gallery/04-contatti.webp"><img src="docs/gallery/04-contatti-thumb.webp" width="420" alt="Menu di accesso rapido a Telefono e WhatsApp"></a><br>
      <strong>Telefono e WhatsApp</strong><br>
      <sub>Menu di accesso rapido alle applicazioni di comunicazione.</sub>
    </td>
    <td width="50%" valign="top">
      <a href="docs/gallery/05-radio.webp"><img src="docs/gallery/05-radio-thumb.webp" width="420" alt="Riproduzione di Radio Italia con VU meter stereo"></a><br>
      <strong>Radio Internet</strong><br>
      <sub>Radio in streaming con VU meter in modalità demo.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/gallery/06-jellyfin.webp"><img src="docs/gallery/06-jellyfin-thumb.webp" width="420" alt="Riproduzione Jellyfin con copertina e spettro audio"></a><br>
      <strong>Jellyfin</strong><br>
      <sub>Riproduzione dalla libreria musicale personale, con copertina e spettro.</sub>
    </td>
    <td width="50%" valign="top">
      <a href="docs/gallery/07-vu-meter.webp"><img src="docs/gallery/07-vu-meter-thumb.webp" width="420" alt="Indicatori VU stereo dei canali sinistro e destro"></a><br>
      <strong>VU meter stereo</strong><br>
      <sub>Indicatori graduati dei canali sinistro e destro durante la riproduzione locale.</sub>
    </td>
  </tr>
</table>

<h3>Installazione reale in auto</h3>

<p align="center">
  <a href="docs/gallery/08-supporto-ipad.webp">
    <img src="docs/gallery/08-supporto-ipad-thumb.webp" width="720" alt="Vista posteriore del supporto che fissa l’iPad al cruscotto">
  </a><br>
  <sub><strong>Supporto per iPad.</strong> Vista posteriore del supporto utilizzato nell’installazione reale.</sub>
</p>

<blockquote>
  <p>La disponibilità delle app e dell’affiancamento dipende dal dispositivo e dal sistema operativo. Le fotografie non attestano compatibilità USB/iPod. Configurare la Dashboard e utilizzare i comandi soltanto a veicolo fermo, nel rispetto delle norme sulla circolazione e sulla sicurezza.</p>
</blockquote>
<!-- gallery:end -->

## Utilizzo

La PWA si avvia con `index.html` su un sito HTTPS. I file sono pubblicati nella radice del repository per il corretto funzionamento di GitHub Pages. Funzioni di navigazione e applicazioni esterne dipendono dal dispositivo e dal browser.

Per Jellyfin, ciascun utente deve configurare il proprio server e il proprio account. Il server deve essere raggiungibile in HTTPS e autorizzare le richieste provenienti dall'origine della pagina tramite CORS. GitHub Pages non fornisce un proxy Jellyfin e l'accesso non è garantito senza configurazione dell'utente.

## Privacy e dati

I file pubblicati non includono credenziali preconfigurate. I dati inseriti nel browser dall'utente possono essere archiviati localmente dalla PWA, secondo le impostazioni dell'app. Non condividere file di backup contenenti credenziali.

## Diritti

Copyright © 2026 Domenico Pizzata. Tutti i diritti riservati.

Vedi il file `LICENSE` per le condizioni di utilizzo. Il software non è pubblicato con una licenza open source.

## Note

Questa copia è separata dalla versione distribuita su Aruba. La pubblicazione su GitHub Pages non aggiorna Aruba e viceversa.

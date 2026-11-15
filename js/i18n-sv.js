/* Svenska (Swedish).
   1) The setup strings that go through I18n.t().
   2) A phrase book for the rest of the interface: while Swedish is on, any text on screen
      that exactly matches an English phrase below is shown in Swedish (and switched back
      when you change language). Your own text (documents, typing) is never touched. */
(function () {
  "use strict";
  if (!window.I18n || !I18n.add) return;

  I18n.add("sv", "Svenska (Sverige)", {
    region_title: "Är det här rätt land eller region?",
    region_sub: "Windows 12 stöder ett språk och översätter allt åt dig.",
    language: "Språk", yes: "Ja",
    access_title: "Hjälpmedelsinställningar",
    access_sub: "Ställ in det nu, eller hoppa över och ändra senare i Inställningar.",
    appearance: "Utseende", light: "Ljust", dark: "Mörkt", text_size: "Textstorlek",
    osk: "Skärmtangentbord", on: "På", off: "Av",
    later_settings: "Senare i inställningar", set_up: "Konfigurera",
    activate_title: "Aktivera Windows",
    activate_sub: "Har du en produktnyckel? Ange den nu, eller hoppa över och aktivera senare.",
    view_keys: "Visa listan med 100 nycklar", skip: "Hoppa över", continue: "Fortsätt",
    key_redeemed: "Produktnyckeln har redan använts", key_invalid: "Ogiltig nyckel",
    create_account: "Skapa ditt konto", signin_account: "Logga in på ditt konto",
    account_required: "Ett konto krävs för att slutföra aktiveringen av Windows.",
    account_optional: "Lägg till ett konto, eller hoppa över för tillfället.",
    email: "E-post", password: "Lösenord",
    agree_pre: "Jag godkänner", terms: "användarvillkoren", next: "Nästa",
    email_pw_required: "E-post och lösenord krävs.",
    make_yours: "Gör den till din",
    make_yours_sub: "Lägg till en profilbild och ett användarnamn och välj sedan hur du loggar in.",
    upload_photo: "Ladda upp ett foto", no_photo: "Inget foto", username: "Användarnamn",
    signin_method: "Inloggningsmetod", pin: "PIN-kod", pin_label: "PIN-kod (4 eller 6 siffror)",
    enter_pin: "Ange PIN-kod", enter_password: "Ange lösenord",
    pin_error: "PIN-koden måste vara exakt 4 eller 6 siffror.", pw_required: "Lösenord krävs.",
    datetime_title: "Datum och tid", datetime_sub: "Ställ in automatiskt eller välj en egen tid.",
    mode: "Läge", automatic: "Automatiskt", custom: "Anpassat",
    clock_format: "Klockformat", h12: "12 timmar", h24: "24 timmar",
    custom_time: "Egen tid", preview: "Förhandsgranskning", finish: "Slutför",
    search_apps: "Sök efter appar", getting_ready: "Vi gör allt klart för dig",
    dont_turn_off: "Stäng inte av datorn.",
  });

  const P = {
    // ---- common buttons / words ----
    "OK": "OK", "Cancel": "Avbryt", "Close": "Stäng", "Save": "Spara", "Back": "Tillbaka", "Next": "Nästa", "Done": "Klar", "Open": "Öppna",
    "Delete": "Ta bort", "Rename": "Byt namn", "Remove": "Ta bort", "Yes": "Ja", "No": "Nej", "Skip": "Hoppa över", "Skip for now": "Hoppa över för tillfället",
    "Continue": "Fortsätt", "Finish": "Slutför", "Set up": "Konfigurera", "Sign in": "Logga in", "Sign out": "Logga ut", "Search": "Sök", "Settings": "Inställningar",
    "Change": "Ändra", "Apply": "Verkställ", "Edit": "Redigera", "Refresh": "Uppdatera", "Reload": "Läs in igen", "Uninstall": "Avinstallera", "Install": "Installera",
    "Get": "Hämta", "Play": "Spela", "Clear": "Rensa", "More": "Mer", "All": "Alla", "Apps": "Appar", "Images": "Bilder", "Files": "Filer", "Folders": "Mappar",
    "Test it": "Testa", "Try again": "Försök igen", "Browse files": "Bläddra bland filer", "Browse photos": "Bläddra bland foton", "Looks good": "Ser bra ut",
    "Help": "Hjälp", "Copy": "Kopiera", "Cut": "Klipp ut", "Paste": "Klistra in", "New": "Nytt", "Sort by": "Sortera efter", "Layout": "Layout", "Details": "Detaljer", "Icons": "Ikoner",
    "Name": "Namn", "Date modified": "Ändringsdatum", "Type": "Typ", "Size": "Storlek", "Run": "Kör",
    // ---- Start menu, power, taskbar, search ----
    "Pinned": "Fäst", "All apps": "Alla appar", "Suggested files": "Föreslagna filer", "Recently opened": "Nyligen öppnade", "Recommended": "Rekommenderat",
    "Documents": "Dokument", "Pictures": "Bilder", "Music": "Musik", "Videos": "Videoklipp", "Downloads": "Hämtade filer", "Desktop": "Skrivbord",
    "Lock": "Lås", "Sleep": "Viloläge", "Restart": "Starta om", "Shut down": "Stäng av", "Search Anything": "Sök efter vad som helst",
    "Search for apps, settings and files": "Sök efter appar, inställningar och filer", "Search for apps, the web and images": "Sök efter appar, webben och bilder",
    "Best match": "Bästa matchning", "No apps found": "Inga appar hittades", "Search the web": "Sök på webben", "Top result": "Bästa resultat", "Dictionary": "Ordlista",
    "Unpin from Start": "Ta bort från Start", "Pin to Start": "Fäst på Start", "Move to front": "Flytta först", "Widgets": "Widgetar", "To do": "Att göra", "Add a task": "Lägg till en uppgift",
    "Add": "Lägg till", "No tasks yet": "Inga uppgifter än", "Watchlist": "Bevakningslista", "See more images ›": "Visa fler bilder ›", "Save to Pictures": "Spara i Bilder", "Open page": "Öppna sidan",
    // ---- desktop ----
    "Recycle Bin": "Papperskorgen", "Personalize": "Anpassa", "View": "Visa", "Show Spotify widget": "Visa Spotify-widget", "Recent listens": "Senast lyssnat",
    "Rename group": "Byt namn på grupp", "Ungroup": "Dela upp grupp", "Delete group": "Ta bort grupp",
    // ---- lock screen ----
    "Forgot PIN?": "Glömt PIN-koden?", "Skip (test mode)": "Hoppa över (testläge)", "Incorrect — try again.": "Fel – försök igen.", "PIN": "PIN-kod", "Password": "Lösenord",
    // ---- Settings ----
    "System": "System", "Bluetooth & devices": "Bluetooth och enheter", "Network & internet": "Nätverk och internet", "Personalization": "Anpassning",
    "Accounts": "Konton", "Time & language": "Tid och språk", "Gaming": "Spel", "Accessibility": "Hjälpmedel", "Privacy & security": "Sekretess och säkerhet",
    "Windows Update": "Windows Update", "Find a setting": "Hitta en inställning", "Search results": "Sökresultat", "Local Account": "Lokalt konto", "Administrator": "Administratör",
    "Display": "Skärm", "Sound": "Ljud", "Notifications": "Aviseringar", "Focus": "Fokus", "Power & battery": "Energi och batteri", "Storage": "Lagring",
    "Multitasking": "Multitasking", "Activation": "Aktivering", "Troubleshoot": "Felsök", "Recovery": "Återställning", "Projecting to this PC": "Projicera till den här datorn",
    "Remote Desktop": "Fjärrskrivbord", "Clipboard": "Urklipp", "About": "Om",
    "Brightness, night light, text size": "Ljusstyrka, nattljus, textstorlek", "Volume, output, input, sound devices": "Volym, utdata, indata, ljudenheter",
    "Alerts from apps and system, do not disturb": "Aviseringar från appar och system, stör ej", "Do not disturb, automatic rules": "Stör ej, automatiska regler",
    "Sleep, battery usage, battery saver": "Viloläge, batterianvändning, batterisparläge", "Storage space, drives, configuration rules": "Lagringsutrymme, enheter, konfigurationsregler",
    "Snap windows, desktops, task switching": "Fäst fönster, skrivbord, aktivitetsväxling", "Activation state, subscriptions, product key": "Aktiveringsstatus, prenumerationer, produktnyckel",
    "Recommended troubleshooters, preferences, history": "Rekommenderade felsökare, inställningar, historik", "Reset, advanced startup, go back": "Återställ, avancerad start, gå tillbaka",
    "Permissions, pairing PIN, discoverability": "Behörigheter, PIN-kod för parkoppling, synlighet", "Remote Desktop users, connection permissions": "Fjärrskrivbordsanvändare, anslutningsbehörigheter",
    "Cut and copy history, sync, clear": "Historik för klipp ut och kopiera, synkronisering, rensa", "Device specifications, rename PC, Windows specifications": "Enhetsspecifikationer, byt namn på datorn, Windows-specifikationer",
    "Add device": "Lägg till enhet", "Search for new Bluetooth devices": "Sök efter nya Bluetooth-enheter", "Mouse": "Mus", "Buttons, pointer speed, scrolling": "Knappar, pekarhastighet, rullning",
    "Devices & drivers": "Enheter och drivrutiner", "Fingerprint sensor, mouse, keyboard — drivers and status": "Fingeravtrycksläsare, mus, tangentbord – drivrutiner och status",
    "Printers & scanners": "Skrivare och skannrar", "Set up and troubleshoot printers": "Konfigurera och felsök skrivare", "Phone Link": "Phone Link", "Get to your phone's photos, texts and more": "Kom åt telefonens foton, sms och mer",
    "Touchpad": "Pekplatta", "Taps, scrolling, zoom, gestures": "Tryck, rullning, zoom, gester", "Pen & touch": "Penna och pekskärm", "Pen settings, touch screen": "Penninställningar, pekskärm",
    "USB": "USB", "Connect more devices with USB": "Anslut fler enheter med USB", "Bluetooth": "Bluetooth", "My device's name": "Enhetens namn", "Rename": "Byt namn",
    "Wi-Fi": "Wi-Fi", "Signal strength": "Signalstyrka", "Strong": "Stark", "Weak": "Svag", "Mobile network": "Mobilnätverk", "VPN": "VPN", "Add, connect, manage": "Lägg till, anslut, hantera",
    "Mobile hotspot": "Mobil hotspot", "Share your internet connection": "Dela din internetanslutning", "Airplane mode": "Flygplansläge", "Proxy": "Proxy", "Dial-up": "Fjärranslutning",
    "Advanced network settings": "Avancerade nätverksinställningar", "View all network adapters, network reset": "Visa alla nätverkskort, nätverksåterställning", "Wi-Fi connected": "Ansluten till Wi-Fi",
    "Not connected": "Inte ansluten", "Disconnect": "Koppla från", "Connect": "Anslut",
    "Background": "Bakgrund", "Pictures, solid colors, upload your own": "Bilder, enfärgade, ladda upp egen", "Colors": "Färger", "Accent color for Windows": "Accentfärg för Windows",
    "Themes": "Teman", "Windows 12 or the classic Windows XP look": "Windows 12 eller det klassiska Windows XP-utseendet", "Personalize icons": "Anpassa ikoner", "Change the icon of any app": "Byt ikon för valfri app",
    "Rounded corners": "Rundade hörn", "Round the corners of windows and menus": "Runda hörnen på fönster och menyer", "Animation effects": "Animeringseffekter", "Animate windows and controls": "Animera fönster och kontroller",
    "Shadows": "Skuggor", "Show shadows under windows and menus": "Visa skuggor under fönster och menyer", "Transparency effects": "Genomskinlighetseffekter", "Frosted-glass windows, menus and taskbar": "Frostat glas för fönster, menyer och aktivitetsfält",
    "Startup sound": "Startljud", "Play a sound when Windows starts": "Spela upp ett ljud när Windows startar", "Current color": "Aktuell färg", "Windows colors": "Windows-färger", "Custom color": "Anpassad färg",
    "Solid colors": "Enfärgade", "Choose a photo": "Välj ett foto",
    "Installed apps": "Installerade appar", "Open or uninstall your apps": "Öppna eller avinstallera dina appar", "Default apps": "Standardappar", "Offline maps": "Offlinekartor", "Optional features": "Valfria funktioner",
    "Apps for websites": "Appar för webbplatser", "Video playback": "Videouppspelning", "Startup": "Autostart",
    "Your info": "Din info", "Your name, profile picture": "Ditt namn, profilbild", "Sign-in options": "Inloggningsalternativ", "PIN, password, Windows Hello": "PIN-kod, lösenord, Windows Hello",
    "Email & accounts": "E-post och konton", "Family": "Familj", "Windows Backup": "Windows-säkerhetskopiering", "Other users": "Andra användare", "Access work or school": "Åtkomst till arbete eller skola",
    "Your name": "Ditt namn", "Remove photo": "Ta bort foto",
    "Date & time": "Datum och tid", "Language & region": "Språk och region", "Typing": "Skriva", "Speech": "Tal", "Windows display language": "Visningsspråk för Windows",
    "Set time automatically": "Ställ in tiden automatiskt", "24-hour clock": "24-timmarsklocka", "Time zone": "Tidszon", "Country or region": "Land eller region", "Regional format": "Regionalt format",
    "Current device time:": "Aktuell tid på enheten:",
    "Game Bar": "Spelfältet", "Captures": "Inspelningar", "Game Mode": "Spelläge", "Optimize your PC for play": "Optimera datorn för spel",
    "Text size": "Textstorlek", "Dark mode": "Mörkt läge", "Use dark colors in Windows and apps": "Använd mörka färger i Windows och appar", "On-screen keyboard": "Skärmtangentbord",
    "Type with the mouse or touch": "Skriv med musen eller pekskärmen", "Visual effects": "Visuella effekter", "Mouse pointer and touch": "Muspekare och pekskärm", "Narrator": "Skärmläsaren", "Magnifier": "Förstoringsglas", "Captions": "Undertexter",
    "Windows Security": "Windows-säkerhet", "Find my device": "Hitta min enhet", "Device encryption": "Enhetskryptering", "Location": "Plats", "Camera": "Kamera", "Microphone": "Mikrofon",
    "Let apps use your location": "Låt appar använda din plats", "Let apps use your camera": "Låt appar använda kameran", "Let apps use your microphone": "Låt appar använda mikrofonen",
    "Pause updates": "Pausa uppdateringar", "Update history": "Uppdateringshistorik", "Advanced options": "Avancerade alternativ", "Check for updates": "Sök efter uppdateringar",
    "You're up to date": "Du är uppdaterad", "Updates available": "Uppdateringar finns", "Download & install all": "Ladda ned och installera alla", "Restart now": "Starta om nu",
    "Brightness": "Ljusstyrka", "Night light": "Nattljus", "Volume": "Volym", "Do not disturb": "Stör ej", "Lock now": "Lås nu", "Lock your PC": "Lås datorn", "Reset PC": "Återställ datorn",
    "Reset this PC": "Återställ den här datorn", "Device name": "Enhetsnamn", "Rename this PC": "Byt namn på datorn", "Device specifications": "Enhetsspecifikationer", "Windows specifications": "Windows-specifikationer",
    "Edition": "Utgåva", "Version": "Version", "Processor": "Processor", "Installed RAM": "Installerat RAM-minne", "System type": "Systemtyp", "Driver": "Drivrutin", "Provider": "Leverantör", "Date": "Datum",
    "Keyboard": "Tangentbord", "Touch screen": "Pekskärm", "Display adapter": "Bildskärmskort", "✓ This device is working properly.": "✓ Den här enheten fungerar som den ska.",
    // ---- File Explorer ----
    "File Explorer": "Utforskaren", "This PC": "Den här datorn", "Quick Access": "Snabbåtkomst", "Quick access": "Snabbåtkomst", "OneDrive": "OneDrive", "Label": "Etikett",
    "Red": "Röd", "Blue": "Blå", "Yellow": "Gul", "Green": "Grön", "Orange": "Orange", "Purple": "Lila", "Pink": "Rosa", "Devices and drivers": "Enheter och diskar",
    "Recent files": "Senaste filer", "This folder is empty.": "Den här mappen är tom.", "Open in new tab": "Öppna i ny flik", "Open file location": "Öppna filplats", "Remove label": "Ta bort etikett",
    "Folder": "Mapp", "Text document": "Textdokument", "Word document": "Word-dokument", "PowerPoint presentation": "PowerPoint-presentation", "Excel worksheet": "Excel-kalkylblad",
    "Upload from this device…": "Ladda upp från den här enheten…", "Details view": "Detaljvy", "Icons view": "Ikonvy", "Local Disk (C:)": "Lokal disk (C:)", "Local Disk (D:)": "Lokal disk (D:)",
    // ---- browsers ----
    "Search or enter address": "Sök eller ange en adress", "Search Google or type a URL": "Sök på Google eller skriv en URL", "Search the web": "Sök på webben", "Recent searches": "Senaste sökningar",
    "Quick answer": "Snabbt svar", "Before you browse": "Innan du surfar", "Are you 18 or older?": "Är du 18 år eller äldre?", "No, I'm under 18": "Nej, jag är under 18",
    "Yes, I'm 18 or older": "Ja, jag är 18 eller äldre", "Suspicious website": "Misstänkt webbplats", "Adult content warning": "Varning för vuxeninnehåll", "Blocked by SafeSearch": "Blockerad av SafeSearch",
    "SafeSearch is on": "SafeSearch är på", "Not secure": "Inte säker", "Go back (recommended)": "Gå tillbaka (rekommenderas)", "Go back": "Gå tillbaka", "Continue anyway": "Fortsätt ändå",
    "I'm 18 or older — continue": "Jag är 18 eller äldre – fortsätt", "New tab": "Ny flik", "Read aloud": "Läs högt", "Favorites": "Favoriter", "Collections": "Samlingar",
    // ---- Copilot / Apple Pay / misc ----
    "New chat": "Ny chatt", "Message Copilot": "Skicka meddelande till Copilot", "Library": "Bibliotek", "Create": "Skapa", "Agents": "Agenter", "Notebooks": "Anteckningsböcker",
    "Pay with Touch ID": "Betala med Touch ID", "Pretend Card": "Låtsaskort", "Contact": "Kontakt", "Pay": "Betala", "Processing…": "Bearbetar…", "Use fake test card": "Använd falskt testkort",
    "Save card & continue": "Spara kort och fortsätt", "OR PAY WITH CARD": "ELLER BETALA MED KORT", "Card holder full name": "Kortinnehavarens fullständiga namn", "Card Number": "Kortnummer", "Expiry Date": "Utgångsdatum",
    // ---- setup (OOBE) ----
    "Welcome to Windows Setup": "Välkommen till Windows-installationen", "Repair Windows": "Reparera Windows", "Activate Windows": "Aktivera Windows", "Privacy Statement": "Sekretesspolicy",
    "I don't have product key": "Jag har ingen produktnyckel", "Downloading Windows 12": "Laddar ned Windows 12", "Let's optimize your display": "Nu optimerar vi din skärm",
    "Drag the slider so Windows 12 looks best on your screen.": "Dra i reglaget så att Windows 12 ser bäst ut på din skärm.", "Is this the right country or region?": "Är det här rätt land eller region?",
    "Language": "Språk", "Make it easier to use your PC": "Gör datorn enklare att använda", "You can change any of this later in Settings.": "Du kan ändra allt det här senare i Inställningar.",
    "How will you use this device?": "Hur kommer du att använda den här enheten?", "We'll set up a few apps and folders to match. You can change this later.": "Vi konfigurerar några appar och mappar som passar. Du kan ändra det senare.",
    "Sign in with a Microsoft account": "Logga in med ett Microsoft-konto", "Let's add your Microsoft account": "Nu lägger vi till ditt Microsoft-konto", "Back to sign in": "Tillbaka till inloggning",
    "Create account": "Skapa konto", "Personalize your device": "Anpassa din enhet", "Add a name and a picture. You can change these later.": "Lägg till ett namn och en bild. Du kan ändra dem senare.",
    "Upload a photo": "Ladda upp ett foto", "Use Windows Hello with your account": "Använd Windows Hello med ditt konto", "Set up a PIN": "Konfigurera en PIN-kod",
    "A Windows Hello PIN is a fast, secure way to sign in to your device, Apps and services.": "En Windows Hello-PIN-kod är ett snabbt och säkert sätt att logga in på enheten, appar och tjänster.",
    "Windows Hello": "Windows Hello", "Set up a fingerprint so you can sign in with a touch. This is optional.": "Konfigurera ett fingeravtryck så att du kan logga in med en beröring. Det är valfritt.",
    "Fingerprint": "Fingeravtryck", "Touch the sensor": "Rör vid sensorn", "Fingerprint in progress": "Fingeravtryck pågår", "All set — your fingerprint works": "Klart – ditt fingeravtryck fungerar",
    "Couldn't read your fingerprint": "Det gick inte att läsa ditt fingeravtryck", "Restore from another device": "Återställ från en annan enhet", "Customize your experience": "Anpassa din upplevelse",
    "Set the date and time": "Ställ in datum och tid", "Choose how the clock behaves on your device.": "Välj hur klockan fungerar på enheten.", "Create a password": "Skapa ett lösenord", "Confirm password": "Bekräfta lösenordet",
    "New PIN": "Ny PIN-kod", "Confirm PIN": "Bekräfta PIN-kod", "Include letters and symbols": "Inkludera bokstäver och symboler",
    // ---- built-in app names ----
    "Calculator": "Kalkylatorn", "Clock": "Klocka", "Notepad": "Anteckningar", "Photos": "Foton", "Calendar": "Kalender", "Weather": "Väder", "calendar": "kalender", "weather": "väder", "photos": "foton", "camera": "kamera",
    "Snipping Tool": "Skärmklippverktyget", "Task Manager": "Aktivitetshanteraren", "Paint": "Paint", "Media Player": "Mediespelaren", "Sticky Notes": "Fästisar", "Maps": "Kartor", "Mail": "E-post",
    "To Do": "Att göra", "News": "Nyheter", "Translator": "Översättare", "Voice Recorder": "Röstinspelaren", "Tips": "Tips", "Color Picker": "Färgväljare", "Achievements": "Prestationer",
    "Office": "Office", "Essentials": "Grundläggande", "Display language changed.": "Visningsspråket har ändrats.",
    // ---- boot / safety ----
    "Before you start": "Innan du börjar", "I understand": "Jag förstår", "Click to skip": "Klicka för att hoppa över", "Not affiliated with Microsoft": "Inte associerat med Microsoft",
    "All money, accounts, and purchases are fake.": "Alla pengar, konton och köp är på låtsas.",
  };
  const ATTRS = ["placeholder", "title", "aria-label"];
  const orig = new WeakMap();        // text node -> original English
  const origAttr = new WeakMap();    // element -> {attr: original}
  const SKIP = "textarea,input,[contenteditable],[contenteditable] *,pre,code,script,style,.cop-bubble,.files-ta,.np-text";
  let on = false, mo = null;

  function trNode(n) {
    if (n.nodeType === 3) {
      const raw = n.nodeValue; if (!raw || !raw.trim()) return;
      const p = n.parentElement; if (!p || p.closest(SKIP)) return;
      const k = raw.trim(), sv = P[k];
      if (sv && sv !== k) { orig.set(n, raw); n.nodeValue = raw.replace(k, sv); }
      else if (orig.has(n) && P[orig.get(n).trim()] !== k) orig.delete(n);   // the app changed this text since
    } else if (n.nodeType === 1) {
      if (n.matches && n.matches("script,style")) return;
      ATTRS.forEach((a) => { const v = n.getAttribute && n.getAttribute(a); if (v && P[v.trim()] && P[v.trim()] !== v.trim()) { const o = origAttr.get(n) || {}; if (!(a in o)) { o[a] = v; origAttr.set(n, o); } n.setAttribute(a, P[v.trim()]); } });
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let c; while ((c = w.nextNode())) {
        if (c.nodeType === 3) trNode(c);
        else ATTRS.forEach((a) => { const v = c.getAttribute(a); if (v && P[v.trim()] && P[v.trim()] !== v.trim()) { const o = origAttr.get(c) || {}; if (!(a in o)) { o[a] = v; origAttr.set(c, o); } c.setAttribute(a, P[v.trim()]); } });
      }
    }
  }
  function restore() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let c; while ((c = w.nextNode())) {
      if (c.nodeType === 3) { if (orig.has(c)) { c.nodeValue = orig.get(c); orig.delete(c); } }
      else { const o = origAttr.get(c); if (o) { Object.keys(o).forEach((a) => c.setAttribute(a, o[a])); origAttr.delete(c); } }
    }
  }
  function enable() {
    if (on) return; on = true;
    trNode(document.body);
    mo = new MutationObserver((ms) => { for (const m of ms) { if (m.type === "childList") m.addedNodes.forEach(trNode); else if (m.type === "characterData") trNode(m.target); else if (m.type === "attributes") trNode(m.target); } });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.documentElement.lang = "sv";
  }
  function disable() { if (!on) return; on = false; if (mo) mo.disconnect(); mo = null; restore(); document.documentElement.lang = "en"; }
  const sync = () => (I18n.lang === "sv" ? enable() : disable());
  document.addEventListener("langchange", sync);
  if (document.body) sync(); else document.addEventListener("DOMContentLoaded", sync);
  window.SvPhrases = { phrases: P, enable, disable };
})();

(() => {
"use strict";
const $ = s => document.querySelector(s);
const KEY = "infosegura-history-v1";
let selectedFile = null, lastResult = null, fontScale = 1, toastTimer;
const pages = ["inicio","resultado","historial","aprende","ayuda"];

function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}
function navigate(id) {
  pages.forEach(page => { const el = document.getElementById(page); if (el) el.hidden = page !== id; });
  document.querySelectorAll(".nav-link").forEach(link => {
    const active = link.dataset.page === id; link.classList.toggle("active", active);
    active ? link.setAttribute("aria-current","page") : link.removeAttribute("aria-current");
  });
  $("#nav").classList.remove("open"); $("#menuToggle").setAttribute("aria-expanded","false");
  if (id === "historial") renderHistory();
  window.scrollTo({top:0,behavior:"smooth"});
}
function go(id) { history.replaceState(null,"",`#${id}`); navigate(id); }
function hashRoute() { const id = location.hash.slice(1); navigate(pages.includes(id) ? id : "inicio"); }

document.querySelectorAll(".nav-link").forEach(a => a.addEventListener("click",e=>{e.preventDefault();go(a.dataset.page)}));
document.querySelectorAll('a[href="#inicio"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();go("inicio")}));
window.addEventListener("hashchange",hashRoute);
$("#menuToggle").addEventListener("click",()=>{const open=$("#nav").classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open))});
hashRoute();

// Accesibilidad: escala de texto y contraste.
function setScale(){document.documentElement.style.setProperty("--scale",fontScale)}
$("#fontUp").addEventListener("click",()=>{fontScale=Math.min(1.35,+(fontScale+.1).toFixed(2));setScale()});
$("#fontDown").addEventListener("click",()=>{fontScale=Math.max(.9,+(fontScale-.1).toFixed(2));setScale()});
$("#contrast").addEventListener("click",e=>{const on=document.body.classList.toggle("high-contrast");e.currentTarget.setAttribute("aria-pressed",String(on));toast(on?"Alto contraste activado.":"Alto contraste desactivado.")});

// Entrada y adjuntos.
const input=$("#content");
input.addEventListener("input",()=>{$("#counter").textContent=`${input.value.length} caracteres`;$("#inputError").hidden=true});
$("#file").addEventListener("change",e=>{
  const file=e.target.files[0]; if(!file)return;
  const valid=/^(image|audio|video)\//.test(file.type)||/\.(pdf|txt)$/i.test(file.name);
  if(!valid){toast("Formato no compatible. Adjunta imagen, audio, video, PDF o TXT.");e.target.value="";return}
  if(file.size>15*1024*1024){toast("El archivo supera el límite de 15 MB.");e.target.value="";return}
  selectedFile=file;$("#fileInfo").textContent=`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB` ;$("#filePreview").hidden=false;
  toast("Archivo adjuntado correctamente.");
});
$("#removeFile").addEventListener("click",()=>{selectedFile=null;$("#file").value="";$("#filePreview").hidden=true});

$("#dictate").addEventListener("click",()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast("El navegador no admite dictado por voz.");return}
  const rec=new SR();rec.lang="es-PE";rec.interimResults=false;$("#dictate").disabled=true;$("#dictate").textContent="Escuchando…";
  rec.onresult=e=>{input.value+=(input.value?" ":"")+e.results[0][0].transcript;input.dispatchEvent(new Event("input"))};
  rec.onerror=()=>toast("No se pudo reconocer la voz. Inténtalo otra vez.");
  rec.onend=()=>{$("#dictate").disabled=false;$("#dictate").textContent="🎙 Dictar"};
  rec.start();
});

// Reglas locales demostrativas. No realizan fact-checking ni detección real de IA.
const rules=[
  [/\b(urgente|inmediatamente|ahora mismo|última oportunidad|último aviso)\b/i,"El mensaje utiliza lenguaje de urgencia o presión."],
  [/\b(gana|ganaste|premio|sorteo|bono gratis|reclama tu premio)\b/i,"Se mencionan premios o beneficios inesperados."],
  [/\b(contraseña|clave|código de verificación|datos bancarios|número de tarjeta)\b/i,"Se solicitan datos personales o información sensible."],
  [/\b(transfiere|depósito|envía dinero|paga hoy|yape|plin)\b/i,"Se solicita realizar un pago o transferencia."],
  [/\b(bloquearemos|suspenderemos|perderás tu cuenta|serás sancionado)\b/i,"Se utiliza una amenaza o advertencia para presionar."],
  [/https?:\/\/[^\s]+/i,"El contenido incluye un enlace: comprueba cuidadosamente el dominio antes de abrirlo."]
];
function analyze(text){
  const signals=rules.filter(([re])=>re.test(text)).map(([,label])=>label);
  if(text.length<20)signals.push("El contenido es breve y no aporta suficiente contexto.");
  if(!signals.length)signals.push("No se encontraron las señales textuales contempladas en esta demostración.");
  const risk=signals.some(s=>/datos personales|pago|transferencia|amenaza/.test(s));
  const caution=!risk&&signals.some(s=>/urgencia|premios|enlace|breve/.test(s));
  const level=risk?"risk":caution?"caution":"low";
  return {level,title:risk?"Señales de riesgo detectadas":caution?"Requiere corroboración":"Sin señales textuales detectadas",
    description:risk?"El texto contiene expresiones que conviene revisar con precaución.":caution?"Hay elementos que requieren una comprobación adicional.":"La revisión básica no encontró las señales textuales contempladas.",
    signals,explanation:"Este resultado se basa únicamente en patrones de texto de una demostración académica. No confirma si la información es verdadera o falsa. Comprueba quién la publicó, cuándo se publicó y si aparece en fuentes oficiales o medios confiables."};
}
function showResult(result){
  lastResult=result;const status=$("#status");status.className=`status ${result.level}`;
  $("#statusIcon").textContent=result.level==="risk"?"!":result.level==="low"?"✓":"?";
  $("#statusTitle").textContent=result.title;$("#statusDesc").textContent=result.description;
  $("#signals").replaceChildren(...result.signals.map(s=>{const li=document.createElement("li");li.textContent=s;return li}));
  $("#explanation").textContent=result.explanation;go("resultado");
}
$("#verifyForm").addEventListener("submit",e=>{
  e.preventDefault();const text=input.value.trim();
  if(!text&&!selectedFile){$("#inputError").textContent="Escribe un mensaje o adjunta un archivo antes de continuar.";$("#inputError").hidden=false;input.focus();return}
  let result;
  if(text)result=analyze(text);
  else result={level:"caution",title:"Archivo recibido; análisis no disponible",description:"El archivo se adjuntó correctamente, pero esta versión no analiza su autenticidad.",
    signals:[`Archivo adjunto: ${selectedFile.name}.`,"No se ejecutó un análisis técnico de imagen, audio o video.","Contrasta el archivo con su fuente original antes de compartirlo."],
    explanation:"Para detectar manipulaciones o contenido generado con IA se necesita integrar un servicio especializado. Esta demostración solo implementa la selección del archivo y el flujo de interfaz."};
  showResult({id:Date.now(),content:text||`[Archivo: ${selectedFile.name}]`,date:new Date().toISOString(),...result});
  toast("Revisión preliminar completada.");
});

// Historial local del navegador.
function readHistory(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function writeHistory(items){localStorage.setItem(KEY,JSON.stringify(items))}
function renderHistory(filter=""){
  const items=readHistory().filter(x=>x.content.toLowerCase().includes(filter.toLowerCase()));
  const list=$("#historyList");list.replaceChildren();$("#emptyHistory").hidden=items.length>0;
  items.forEach(item=>{
    const row=document.createElement("article");row.className="history-item";
    const info=document.createElement("div");const title=document.createElement("strong");title.textContent=item.content.length>100?item.content.slice(0,100)+"…":item.content;
    const date=document.createElement("small");date.textContent=new Date(item.date).toLocaleString("es-PE");info.append(title,date);
    const actions=document.createElement("div");actions.className="history-actions";
    const pill=document.createElement("span");pill.className=`pill ${item.level}`;pill.textContent=item.title;
    const view=document.createElement("button");view.className="btn outline";view.textContent="Ver";view.addEventListener("click",()=>showResult(item));
    const del=document.createElement("button");del.className="btn outline";del.textContent="Eliminar";del.addEventListener("click",()=>{writeHistory(readHistory().filter(x=>x.id!==item.id));renderHistory($("#searchHistory").value);toast("Registro eliminado.")});
    actions.append(pill,view,del);row.append(info,actions);list.append(row);
  });
}
$("#save").addEventListener("click",()=>{if(!lastResult)return;const all=readHistory();if(!all.some(x=>x.id===lastResult.id)){all.unshift(lastResult);writeHistory(all.slice(0,50))}toast("Resultado guardado en este navegador.")});
$("#searchHistory").addEventListener("input",e=>renderHistory(e.target.value));
$("#clearHistory").addEventListener("click",()=>{if(confirm("¿Eliminar todas las verificaciones guardadas en este navegador?")){writeHistory([]);renderHistory();toast("Historial eliminado.")}});

// Audio y reporte.
$("#listen").addEventListener("click",()=>{
  if(!lastResult)return;if(!("speechSynthesis"in window)){toast("El navegador no admite lectura en voz alta.");return}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(`${lastResult.title}. ${lastResult.description}. ${lastResult.explanation}`);u.lang="es-PE";u.rate=.9;speechSynthesis.speak(u);
});
$("#report").addEventListener("click",()=>{
  if(!lastResult)return;const content=["INFOSEGURA - REPORTE DE REVISIÓN PRELIMINAR",`Fecha: ${new Date(lastResult.date).toLocaleString("es-PE")}`,`Contenido: ${lastResult.content}`,`Estado: ${lastResult.title}`,"","Señales:",...lastResult.signals.map(s=>"- "+s),"",lastResult.explanation,"","Nota: demostración frontend; no constituye verificación factual."].join("\n");
  const url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="reporte-infosegura.txt";a.click();URL.revokeObjectURL(url);
});
$("#newCheck").addEventListener("click",()=>{input.value="";input.dispatchEvent(new Event("input"));selectedFile=null;$("#file").value="";$("#filePreview").hidden=true;go("inicio");input.focus()});
$("#helpFromResult").addEventListener("click",()=>{go("ayuda");$("#helpMessage").value="Necesito ayuda para revisar un contenido sospechoso."});

// Contenido educativo desplegable.
const topics={
 scams:["Desconfía de mensajes que exigen actuar inmediatamente.","No compartas contraseñas, códigos ni datos bancarios.","Confirma solicitudes de dinero por otro canal.","Revisa cuidadosamente el dominio de los enlaces.","Consulta directamente el canal oficial de la institución."],
 media:["Busca la publicación original y su fecha.","Comprueba si otras fuentes confiables publicaron el mismo contenido.","Una imagen real puede acompañar una descripción falsa.","Una imperfección visual aislada no demuestra manipulación."],
 ai:["Revisa la procedencia del archivo y quién lo publicó.","Contrasta la afirmación con fuentes independientes.","Las herramientas de IA pueden producir contenidos muy convincentes.","No tomes una señal aislada como prueba definitiva."],
 steps:["Identifica quién creó o publicó el contenido.","Comprueba la fecha y el contexto.","Busca la afirmación en fuentes oficiales o medios confiables.","Compara más de una fuente independiente.","Si no puedes confirmarlo, evita compartirlo como cierto."]
};
const topicNames={scams:"Cómo reconocer posibles estafas",media:"Cómo revisar imágenes y videos",ai:"Señales y límites al evaluar contenido con IA",steps:"Pasos para verificar información"};
document.querySelectorAll(".learn-more").forEach(btn=>btn.addEventListener("click",()=>{
  $("#detailTitle").textContent=topicNames[btn.dataset.topic];
  $("#detailList").replaceChildren(...topics[btn.dataset.topic].map(text=>{const li=document.createElement("li");li.textContent=text;return li}));
  $("#learnDetail").hidden=false;$("#learnDetail").scrollIntoView({behavior:"smooth",block:"nearest"});
}));
$("#closeDetail").addEventListener("click",()=>$("#learnDetail").hidden=true);

// Formulario de ayuda: validación local, sin envío de datos.
$("#helpForm").addEventListener("submit",e=>{
  e.preventDefault();if(!e.currentTarget.reportValidity())return;
  $("#helpFeedback").textContent="Los datos son válidos. Para recibir esta consulta se debe conectar un servicio de envío.";
  toast("Formulario validado en esta demostración.");
});
})();
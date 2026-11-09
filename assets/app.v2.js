'use strict';
const ASSETS=JSON.parse(document.getElementById('assets').textContent);
const DOWNLOAD_ASSETS={"assets/manual-modes-v24.jpg":"assets/manual-modes-v24.jpg","assets/manual-quick-v24.jpg":"assets/manual-quick-v24.jpg"};
const VIEWS=Object.fromEntries([...document.querySelectorAll('[data-view]')].map(e=>[e.dataset.view,e]));
const state={route:'home',values:{age:28,height:167,weight:56.8,waist:76},photos:[null,null],timers:[],downloads:null,viewerIndex:0,viewerReturn:null,toastTimer:null,busy:false};
const routes=['home','details','guide','loading','report'];
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
for(const el of $$('[data-asset]')){el.decoding='async';if(!el.getAttribute('src'))el.src=ASSETS[el.dataset.asset];}
const originalPaperPoses=new WeakMap();for(const box of $$('.paper-poses .figure-cutout'))originalPaperPoses.set(box,box.innerHTML);
const originalGuidePoses=$$('.guide-view .figure-cutout',VIEWS.guide).map(e=>e.innerHTML);
function toast(message){const t=$('.toast');clearTimeout(state.toastTimer);t.textContent=message;t.hidden=false;state.toastTimer=setTimeout(()=>t.hidden=true,3300)}
function fitPhone(){document.documentElement.style.removeProperty('--phone-scale')}
addEventListener('resize',()=>{if(!viewer.hidden)viewerZoom(Number($('.viewer-zoom input',viewer).value))});
function makeAction(el,action){if(!el)return;el.dataset.action=action;el.setAttribute('role','button');el.tabIndex=0}
const mainActions={home:'start',details:'next',guide:'generate',report:'save'};
for(const [name,view] of Object.entries(VIEWS)){makeAction($('.button',view),mainActions[name]);makeAction($('.back',view),'back')}
const fieldDefs=[['age','年龄'],['height','身高'],['weight','体重'],['waist','腰围']];
const SCORE_SAMPLE={age:28,height:167,weight:56.8,waist:76};
state.exampleReport=false;
function reportValues(){return state.exampleReport?SCORE_SAMPLE:state.values}
function computeFive(v,example=false){
 const bmi=v.weight/((v.height/100)**2),whtr=v.waist/v.height,adult=v.age>=18&&v.age<=120;
 let bp=null,bt='待填写',wp=null,wt='待填写',cp=example?15:null,ct=example?'示例：实测腰围展示':'本次实测，不套用性别切点';
 if(adult){
  if(bmi<18.5){bt='偏低，专项评分不适用'}else if(bmi<24){bp=25;bt='成人参考范围内'}else if(bmi<28){bp=18;bt='超重参考区间'}else if(bmi<32.5){bp=12;bt='轻度肥胖参考区间'}else if(bmi<37.5){bp=7;bt='中度肥胖参考区间'}else{bp=3;bt=bmi<50?'重度肥胖参考区间':'极重度肥胖参考区间'}
  if(bmi>=35){wt='BMI≥35，分级参考受限'}else if(whtr<.5){wp=30;wt='参考范围内'}else if(whtr<.6){wp=18;wt='优先关注腰腹比例'}else{wp=6;wt='重点关注腰腹比例'}
 }else{bt=wt=ct='成人分级暂不适用'}
 const dims=[{name:'BMI 指数',max:25,score:bp,note:bmi.toFixed(1)+' · '+bt},{name:'腹部紧致度',max:15,score:example?15:null,note:example?'独立示例':'等待进一步评估',focus:true},{name:'骨盆前倾',max:15,score:example?12:null,note:example?'独立示例':'等待进一步评估'},{name:'腰围身高比',max:30,score:wp,note:whtr.toFixed(2)+' · '+wt},{name:'体态观察',max:15,score:example?13:null,note:example?'示例：骨盆、腰背与膝部':'正面＋侧面 · 待评估'}];
 const completed=dims.filter(d=>d.score!==null),subtotal=completed.reduce((a,d)=>a+d.score,0),max=completed.reduce((a,d)=>a+d.max,0);
 return{dims,bmi,whtr,subtotal,max,total:completed.length===5?subtotal:null};
}
function dimensionFeedback(v,r,example=false){
 const low=r.bmi<18.5,high=r.bmi>=24,valid=r.bmi<35,waistFocus=valid&&r.whtr>=.5;
 const bmi={reading:'BMI '+r.bmi.toFixed(1),status:low?'体重偏低':r.bmi<24?'参考范围内':r.bmi<28?'体重偏高':'重点关注',summary:low?'体重偏低，优先保证均衡营养，避免刻意减重。':r.bmi<24?'体重处于参考范围，保持均衡饮食和规律活动。':r.bmi<35?'体重偏高，先减少含糖饮品并逐步增加日常活动。':'体重需重点关注，建议结合专业评估安排饮食与活动。',issue:low||high};
 const ratio=example?{reading:'腹部状态 · 独立示例',status:'示例参考',summary:'示例：腹部轮廓较平整，建议保持规律活动与日常护理。',issue:false}:{reading:'腹部状态 · 等待评估',status:'待评估',summary:'仅凭照片无法确认紧致度，需结合进一步评估。',issue:false};
 const waist=example?{reading:'骨盆姿态 · 独立示例',status:'示例需关注',summary:'示例：站姿有前挺表现，骨盆姿态需进一步确认。',issue:true}:{reading:'骨盆姿态 · 等待评估',status:'待评估',summary:'骨盆姿态尚待有效评估，日常避免刻意挺腰并减少久坐。',issue:false};
 const belly={reading:'腰围身高比 '+r.whtr.toFixed(2),status:!valid?'参考受限':r.whtr<.5?'参考范围内':r.whtr<.6?'腰腹需关注':'腰腹重点关注',summary:!valid?'当前不套用比例分级，建议结合专业评估了解腰腹情况。':low&&waistFocus?'体重与腰腹比例信号不一致，先核实测量并结合专业评估。':r.whtr<.5?'腰腹比例处于参考范围，保持现有健康习惯。':'腰腹比例偏高，少喝含糖饮品并增加适量活动。',issue:waistFocus};
 const posture=example?{reading:'自然站姿 · 独立示例',status:'示例需关注',summary:'示例：站姿略有腰部前挺，建议减少久坐并避免刻意挺腰。',issue:true}:{reading:'正面＋侧面 · 等待评估',status:'待评估',summary:'体态尚待有效评估，日常先减少久坐并安排舒适的起身活动。',issue:false};
 return [bmi,ratio,waist,belly,posture];
}

function syncScore(){const v=reportValues(),r=computeFive(v,state.exampleReport);
 $('[data-assessment-label]').textContent=state.exampleReport?'独立示例 · 非本次评估':'本次实测 · 部分评分待补充';$('[data-toggle-example]').textContent=state.exampleReport?'返回本次实测':'查看完整评分示例';
 for(const paper of $$('.paper')){if(!$('[data-total-score]',paper))continue;
 $('[data-total-score]',paper).textContent=r.total??'—';$('[data-score-state]',paper).textContent=state.exampleReport?'示例评分 · 仅看效果':'部分维度待评估';$('[data-score-progress]',paper).textContent=state.exampleReport?'五个维度，查看日常管理重点':'已完成 '+r.dims.filter(d=>d.score!==null).length+' 项指标，其余项目待评估';
 const feedback=dimensionFeedback(v,r,state.exampleReport);
 $('[data-score-dimensions]',paper).innerHTML=r.dims.map((d,i)=>{const f=feedback[i];return '<div class="score-dimension'+(d.focus?' score-dimension-focus':'')+(d.score===null?' is-pending':'')+(f.issue?' has-finding':'')+'"><div><b><span class="dimension-index">0'+(i+1)+'</span>'+d.name+(d.focus?'<em>重点</em>':'')+'</b><span class="dimension-status">'+f.status+'</span></div><div class="score-bar"><i style="width:'+(d.score===null?0:d.score/d.max*100)+'%"></i></div><p class="dimension-advice dimension-brief"><span class="dimension-inline">'+f.reading+' · </span>'+f.summary+'</p></div>'}).join('');
 $('[data-score-priority]',paper).textContent=r.bmi<18.5?'本次重点：保证均衡营养，避免刻意减重。':r.bmi>=35?'本次重点：结合专业评估，安排适合自己的饮食与活动。':r.bmi>=24&&r.whtr>=.5?'本次重点：兼顾体重与腰腹，先调整饮食和活动。':r.whtr>=.5?'本次重点：关注腰腹比例，改善饮食质量与活动习惯。':r.bmi>=24?'本次重点：留意体重变化，保持规律用餐与适量活动。':'本次重点：保持稳定体重，延续健康习惯。';
 $('.paper-meta b',paper).textContent=state.exampleReport?'完整示例':'本次填写';
 const observations=$$('.paper-observations b',paper);(state.exampleReport?['示例：腰部略有前挺','示例：下腹轮廓略突出','需结合进一步评估确认']:['等待有效评估','等待有效评估','暂不确认具体问题']).forEach((t,i)=>observations[i].textContent=t);
 const heads=$$('.paper-observations span',paper);['自然站姿','腹部外形','体态结论'].forEach((t,i)=>heads[i].textContent=t);
 }
}
for(const [i,[key,label]] of fieldDefs.entries()){
 const row=$$('.measure-row',VIEWS.details)[i],strong=$('.measure-value strong',row),input=document.createElement('input');
 input.type='number';input.name=key;input.inputMode=key==='age'?'numeric':'decimal';input.step=key==='age'?'1':'0.1';input.min=key==='age'?'18':'0.1';if(key==='age')input.max='120';input.required=true;input.value=key==='age'?String(state.values[key]):state.values[key].toFixed(1);input.setAttribute('aria-label',label+'（必填）');strong.replaceWith(input);
 const err=document.createElement('span');err.className='field-error';err.id='error-'+key;err.hidden=true;row.append(err);input.setAttribute('aria-describedby',err.id);
 input.addEventListener('input',()=>{state.exampleReport=false;row.classList.remove('has-error');input.removeAttribute('aria-invalid');err.hidden=true;state.downloads=null});
}
function readValues(showErrors=true){let ok=true;for(const [key,label] of fieldDefs){const input=$(`input[name=${key}]`,VIEWS.details),n=Number(input.value),valid=input.value.trim()!==''&&Number.isFinite(n)&&(key==='age'?Number.isInteger(n)&&n>=18&&n<=120:n>0&&n<1000);if(!valid){ok=false;if(showErrors){const row=input.closest('.measure-row');row.classList.add('has-error');input.setAttribute('aria-invalid','true');const err=$('.field-error',row);err.textContent=key==='age'?'请填写18–120岁的整数年龄':'请填写有效的'+label;err.hidden=false}}else state.values[key]=key==='age'?n:Math.round(n*10)/10;}
 if(!ok&&showErrors){$('input[aria-invalid=true]',VIEWS.details)?.focus();toast('请完成年龄、身高、体重与腰围四项填写')}return ok}
// Two local image inputs. No file leaves this HTML document.
$$('.guide-view',VIEWS.guide).forEach((panel,i)=>{
 const cap=$('.view-caption',panel);cap.innerHTML=`<label class="photo-pick" for="photo-${i}"><b>${i?'侧面照片':'正面照片'}</b><i>点击上传</i></label><input class="file-input" id="photo-${i}" type="file" accept="image/*" aria-label="${i?'上传侧面照片':'上传正面照片'}">`;
 $('.file-input',panel).addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/'))return toast('请选择图片文件');if(file.size>25*1024*1024)return toast('请使用25MB以内的照片');try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const img=new Image();img.src=data;await img.decode();state.photos[i]=data;state.exampleReport=false;const box=$('.figure-cutout',panel);box.classList.add('photo-custom');box.innerHTML='';const pic=img.cloneNode();pic.alt=i?'上传的侧面照片':'上传的正面照片';box.append(pic);$('.photo-pick i',panel).textContent='重新选择';state.downloads=null;toast('照片已在本地载入')}catch{toast('图片暂时无法读取，请换一张重试')}});
});
$('.guide-page>.subtitle',VIEWS.guide).textContent='可上传正面与侧面照片，也可用示例照片体验。';
$('.loading-page>h2',VIEWS.loading).textContent='正在整理示例报告…';
$('.loading-page>.subtitle',VIEWS.loading).textContent='本次为交互演示，体态建议采用示例内容。';
const tasks=$$('.analysis-tasks p',VIEWS.loading);['实测资料整理','正侧面照片展示','示例方案准备'].forEach((s,i)=>tasks[i].textContent=s);
$('.loading-note',VIEWS.loading).textContent='数据与照片仅在本地预览，不上传';
const viewer=document.createElement('div');viewer.className='image-viewer';viewer.hidden=true;viewer.innerHTML='<div class="viewer-top"><h3>使用指南</h3><button type="button" data-viewer-close aria-label="关闭指南">×</button></div><div class="viewer-scroll"><img alt="高清使用指南原图"></div><div class="viewer-controls"><p>拖动滑块放大，滑动图片查看细节</p><div class="viewer-zoom"><span>缩放</span><input type="range" min="1" max="6" step="0.25" value="1" aria-label="指南缩放"><b>100%</b></div><div class="viewer-links"><button data-viewer-prev>上一张</button><span>1 / 2</span><button data-viewer-save>保存原图</button><button data-viewer-next>下一张</button></div></div>';
$('.screen',VIEWS.report).append(viewer);
const guideFiles=['assets/manual-quick-v24.jpg','assets/manual-modes-v24.jpg'];
const guideNames=['快速使用攻略','产品结构与模式说明'];
$('.viewer-scroll img',viewer).decoding='async';
function setViewer(i){state.viewerIndex=(i+2)%2;$('.viewer-top h3',viewer).textContent=guideNames[state.viewerIndex];$('.viewer-scroll img',viewer).src=DOWNLOAD_ASSETS[guideFiles[state.viewerIndex]]||ASSETS[guideFiles[state.viewerIndex]];$('.viewer-zoom input',viewer).value=1;$('.viewer-zoom b',viewer).textContent='100%';$('.viewer-links>span',viewer).textContent=(state.viewerIndex+1)+' / 2';viewerZoom(1);$('.viewer-scroll',viewer).scrollTo(0,0)}
function viewerZoom(z){const box=$('.viewer-scroll',viewer);$('.viewer-scroll img',viewer).style.width=(box.clientWidth*z)+'px';$('.viewer-zoom b',viewer).textContent=Math.round(z*100)+'%'}
$('.viewer-zoom input',viewer).addEventListener('input',e=>viewerZoom(Number(e.target.value)));
function openViewer(i,trigger){state.viewerReturn=trigger;viewer.hidden=false;document.body.classList.add('dialog-open');setViewer(i);$('[data-viewer-close]',viewer).focus({preventScroll:true})}
function closeViewer(){viewer.hidden=true;document.body.classList.remove('dialog-open');state.viewerReturn?.focus({preventScroll:true})}
function syncReport(){syncScore();const v=reportValues(),bmi=(v.weight/((v.height/100)**2)).toFixed(1);
 for(const paper of $$('.paper')){
  const vals=$$('.paper-metrics>div',paper);if(vals.length===4){$('strong',vals[0]).innerHTML=v.weight.toFixed(1)+'<small>kg</small>';$('strong',vals[1]).textContent=bmi;$('b',vals[2]).innerHTML=v.height.toFixed(1)+'<small>cm</small>';$('b',vals[3]).innerHTML=v.waist.toFixed(1)+'<small>cm</small>'}
  const date=$('.paper-meta>span',paper);if(date)date.textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('/','.');
  const poseEls=$$('.paper-poses .figure-cutout',paper);(state.exampleReport?[null,null]:state.photos).forEach((data,i)=>{if(!data&&poseEls[i]){poseEls[i].classList.remove('photo-custom');poseEls[i].innerHTML=originalPaperPoses.get(poseEls[i])}if(data&&poseEls[i]){poseEls[i].classList.add('photo-custom');poseEls[i].innerHTML=`<img src="${data}" alt="本次上传的${i?'侧面':'正面'}照片" style="position:static;width:100%;height:236px;object-fit:contain;max-width:100%">`}});
 }
}
function clearTimers(){state.timers.forEach(clearTimeout);state.timers=[]}
function showRoute(name,{animate=true}={}){if(!VIEWS[name])return;clearTimers();for(const [k,v] of Object.entries(VIEWS))v.hidden=k!==name;state.route=name;for(const n of $$('[data-route]')){if(n.dataset.route===name)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current')}
 $$('[data-support-dialog]').forEach(m=>m.hidden=true);viewer.hidden=true;document.body.classList.remove('dialog-open');if(name==='report')syncReport();if(name==='loading'&&animate)startLoading();fitPhone();window.scrollTo({top:0,behavior:'instant'})}
function setProgress(n){const ring=$('.loading-ring',VIEWS.loading);$('strong',ring).innerHTML=n+'<small>%</small>';const circles=$$('circle',ring);circles[1].setAttribute('stroke-dasharray',(685*n/100)+' 685');$$('.analysis-tasks>div',VIEWS.loading).forEach((r,i)=>{const done=n>=(i+1)*30;r.classList.toggle('task-done',done);r.classList.toggle('task-pending',!done);$('em',r).textContent=done?'已完成':'整理中';$('span',r).innerHTML=done?'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m5 12 4 4L19 6"/></svg>':'<i></i>'})}
function startLoading(){setProgress(0);for(let i=1;i<=25;i++)state.timers.push(setTimeout(()=>{setProgress(i*4);if(i===25)state.timers.push(setTimeout(()=>showRoute('report'),200))},i*95))}
function restart(){state.exampleReport=false;clearTimers();clearTimeout(state.toastTimer);$('.toast').hidden=true;state.downloads=null;state.values={age:28,height:167,weight:56.8,waist:76};state.photos=[null,null];for(const [key]of fieldDefs)$(`input[name=${key}]`,VIEWS.details).value=key==='age'?String(state.values[key]):state.values[key].toFixed(1);$$('.guide-view',VIEWS.guide).forEach((p,i)=>{const box=$('.figure-cutout',p);box.classList.remove('photo-custom');box.innerHTML=originalGuidePoses[i];$('.file-input',p).value='';$('.photo-pick i',p).textContent='点击上传'});$$('.has-error',VIEWS.details).forEach(e=>e.classList.remove('has-error'));$$('.field-error',VIEWS.details).forEach(e=>e.hidden=true);$$('input[aria-invalid]',VIEWS.details).forEach(e=>e.removeAttribute('aria-invalid'));syncReport();showRoute('home');$('.report-scroll',VIEWS.report).scrollTop=0}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
function dataBlob(data){const [head,b64]=data.split(',');return new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:head.match(/data:([^;]+)/)[1]})}
async function assetBlob(path){const url=DOWNLOAD_ASSETS[path]||ASSETS[path];if(url.startsWith('data:'))return dataBlob(url);const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw new Error('资源暂时无法下载：'+response.status);return response.blob()}
let supportCodeBlob=null,supportCodePromise=null;
function prepareSupportCode(){
 if(supportCodeBlob)return Promise.resolve(supportCodeBlob);
 if(supportCodePromise)return supportCodePromise;
 supportCodePromise=(async()=>{
  const box=$('.support-dialog .qr-viewport',VIEWS.report),img=$('img',box);
  img.loading='eager';img.src=DOWNLOAD_ASSETS[guideFiles[0]]||ASSETS[guideFiles[0]];
  await img.decode();
  const br=box.getBoundingClientRect(),ir=img.getBoundingClientRect();
  const sx=Math.max(0,Math.round((br.left-ir.left)*img.naturalWidth/ir.width));
  const sy=Math.max(0,Math.round((br.top-ir.top)*img.naturalHeight/ir.height));
  const sw=Math.min(img.naturalWidth-sx,Math.round(br.width*img.naturalWidth/ir.width));
  const sh=Math.min(img.naturalHeight-sy,Math.round(br.height*img.naturalHeight/ir.height));
  if(sw<=0||sh<=0)throw new Error('QR image unavailable');
  const pad=Math.max(12,Math.round(Math.max(sw,sh)*.04));
  const canvas=document.createElement('canvas');canvas.width=sw+pad*2;canvas.height=sh+pad*2;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  // Preserve the original QR pixels; add only a white margin for scanning.
  ctx.drawImage(img,sx,sy,sw,sh,pad,pad,sw,sh);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('QR export failed')),'image/png'));
  img.src=URL.createObjectURL(blob);img.alt='VD FIT 使用指引二维码，可长按保存';box.classList.add('qr-ready');
  supportCodeBlob=blob;return blob;
 })().catch(e=>{supportCodePromise=null;throw e});
 return supportCodePromise;
}
async function saveSupportCode(button){
 if(button.disabled)return;
 const label=button.innerHTML;button.disabled=true;button.textContent='正在准备二维码…';
 try{const blob=await prepareSupportCode();downloadBlob(blob,'VD-FIT-使用指引二维码.png');toast('二维码图片已生成，请在浏览器下载中查看')}
 catch(e){console.error('QR download failed',e);toast('二维码暂未生成，请稍后重试')}
 finally{button.disabled=false;button.innerHTML=label}
}

function openSupport(trigger){const m=$('[data-support-dialog]',VIEWS.report);m.hidden=false;document.body.classList.add('dialog-open');m._return=trigger;$('[data-support-close]',m).focus({preventScroll:true});prepareSupportCode().catch(()=>toast('二维码暂未准备好，请稍后重试'))}
function closeSupport(){const m=$('[data-support-dialog]',VIEWS.report);m.hidden=true;document.body.classList.remove('dialog-open');m._return?.focus({preventScroll:true})}
document.addEventListener('click',async e=>{
 if(e.target.closest('[data-toggle-example]')){state.exampleReport=!state.exampleReport;state.downloads=null;syncReport();return}
 const route=e.target.closest('[data-route]');if(route){if(!readValues(false)&&['guide','loading','report'].includes(route.dataset.route))return showRoute('details');return showRoute(route.dataset.route)}
 if(e.target.closest('[data-support-open]'))return openSupport(e.target.closest('[data-support-open]'));
 const supportSave=e.target.closest('[data-support-save]');if(supportSave)return saveSupportCode(supportSave);
 if(e.target.closest('[data-support-close]'))return closeSupport();
 const guide=e.target.closest('.manual-card');if(guide){e.preventDefault();return openViewer(guide.dataset.guideAsset.includes('quick')?0:1,guide)}
 if(e.target.closest('[data-viewer-close]'))return closeViewer();
 if(e.target.closest('[data-viewer-prev]'))return setViewer(state.viewerIndex-1);
 if(e.target.closest('[data-viewer-next]'))return setViewer(state.viewerIndex+1);
 if(e.target.closest('[data-viewer-save]'))return downloadBlob(await assetBlob(guideFiles[state.viewerIndex]),guideNames[state.viewerIndex]+'.jpg');
 const dl=e.target.closest('[data-download]');if(dl){if(dl.dataset.download==='report'){if(!state.downloads?.report)return toast('请先在报告页生成保存文件');return downloadBlob(state.downloads.report,'体重管理评分与专属方案.png')}const k=dl.dataset.download==='quick'?0:1;return downloadBlob(await assetBlob(guideFiles[k]),guideNames[k]+'.jpg')}
 const action=e.target.closest('[data-action]');if(!action||action.getAttribute('aria-disabled')==='true')return;
 switch(action.dataset.action){case'start':showRoute('details');break;case'next':if(readValues())showRoute('guide');break;case'generate':if(readValues())showRoute('loading');else showRoute('details');break;case'view-report':showRoute('report');break;case'restart':restart();break;case'back':{const prev={details:'home',guide:'details',loading:'guide',report:'guide'};showRoute(prev[state.route]||'home');break}case'save':await savePackage(action);break}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!viewer.hidden)return closeViewer();return closeSupport()}const b=e.target.closest('[role=button]');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();b.click()}const modal=$('[data-support-dialog]:not([hidden])',VIEWS.report);if(modal&&e.key==='Tab'){const focus=$$('button',modal);if(e.shiftKey&&document.activeElement===focus[0]){e.preventDefault();focus.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===focus.at(-1)){e.preventDefault();focus[0].focus()}}});
// Export only this report's limited, deterministic HTML/CSS. Images and inputs remain on this device.
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2))}
function colorIsVisible(c){return c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)'}
async function renderReport(){syncReport();await document.fonts.ready;const wrap=document.createElement('div');wrap.className='canvas-rendering';const paper=$('.report-scroll>.paper',VIEWS.report).cloneNode(true);wrap.append(paper);document.body.append(wrap);
 for(const el of $$('.manual-heading p',wrap)){el.textContent='打开已保存的高清指南，可放大阅读';el.style.fontSize='9px'}
 for(const el of $$('.manual-card em',wrap)){el.textContent='高清原图';el.style.fontSize='9px'}
 const note=$('.support-export-note',wrap);if(note)note.textContent='使用指引可返回本次报告查看。';
 try{await Promise.all($$('img',wrap).map(im=>{im.loading='eager';return im.decode().catch(()=>{})}));const rr=wrap.getBoundingClientRect(),scale=3,canvas=document.createElement('canvas');canvas.width=438*scale;canvas.height=Math.ceil(wrap.scrollHeight*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#eff1f5';ctx.fillRect(0,0,438,canvas.height/scale);
 function draw(el){const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return;const r=el.getBoundingClientRect(),x=r.x-rr.x,y=r.y-rr.y,w=r.width,h=r.height;if(w===0||h===0)return;ctx.save();ctx.globalAlpha*=Number(s.opacity);const radius=parseFloat(s.borderTopLeftRadius)||0;
 if(s.mixBlendMode==='multiply')ctx.globalCompositeOperation='multiply';
 if(colorIsVisible(s.backgroundColor)){rounded(ctx,x,y,w,h,radius);ctx.fillStyle=s.backgroundColor;ctx.fill()}
 const gradient=s.backgroundImage.match(/rgba?\([^)]*\)/g);if(gradient?.length>=2){const g=s.backgroundImage.startsWith('radial-gradient')?ctx.createRadialGradient(x+w*.5,y+h*.72,0,x+w*.5,y+h*.72,w*.6):ctx.createLinearGradient(x,y,x+w*.3,y+h);g.addColorStop(0,gradient[0]);g.addColorStop(1,gradient.at(-1));rounded(ctx,x,y,w,h,radius);ctx.fillStyle=g;ctx.fill()}
 const widths=['Top','Right','Bottom','Left'].map(k=>parseFloat(s['border'+k+'Width'])||0);
 if(widths.every(v=>v>0)&&new Set(widths).size===1){const bw=widths[0];rounded(ctx,x+bw/2,y+bw/2,w-bw,h-bw,Math.max(0,radius-bw/2));ctx.lineWidth=bw;ctx.strokeStyle=s.borderTopColor;ctx.stroke()}
 else{for(let i=0;i<4;i++)if(widths[i]>0){ctx.beginPath();const pts=[[x,y,x+w,y],[x+w,y,x+w,y+h],[x,y+h,x+w,y+h],[x,y,x,y+h]][i];ctx.moveTo(pts[0],pts[1]);ctx.lineTo(pts[2],pts[3]);ctx.strokeStyle=s['border'+['Top','Right','Bottom','Left'][i]+'Color'];ctx.lineWidth=widths[i];ctx.stroke()}}
 if(['hidden','clip','scroll','auto'].includes(s.overflow)||s.overflowX==='hidden'||s.overflowY==='hidden'){rounded(ctx,x,y,w,h,radius);ctx.clip()}
 if(el.tagName==='IMG'){if(el.complete&&el.naturalWidth){let dx=x,dy=y,dw=w,dh=h;if(s.objectFit==='contain'||s.objectFit==='cover'){const f=(s.objectFit==='contain'?Math.min:Math.max)(w/el.naturalWidth,h/el.naturalHeight);dw=el.naturalWidth*f;dh=el.naturalHeight*f;dx=x+(w-dw)/2;dy=y+(h-dh)/2}ctx.drawImage(el,dx,dy,dw,dh)}}
 else{for(const child of el.childNodes){if(child.nodeType===Node.ELEMENT_NODE)draw(child);else if(child.nodeType===Node.TEXT_NODE&&child.textContent.trim()&&parseFloat(s.fontSize)>0){ctx.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;ctx.fillStyle=s.color;ctx.textBaseline='alphabetic';const text=child.textContent;for(let i=0;i<text.length;i++){const range=document.createRange();range.setStart(child,i);range.setEnd(child,i+1);const tr=range.getBoundingClientRect();if(tr.width===0||tr.height===0)continue;ctx.fillText(text[i],tr.x-rr.x,tr.bottom-rr.y-parseFloat(s.fontSize)*.2)}}}}
 ctx.restore()}
 draw(paper);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('canvas')),'image/png'))
 }finally{wrap.remove()}}
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function bytesHeader(size){const b=new Uint8Array(size);return[b,new DataView(b.buffer)]}
async function makeZip(files){const enc=new TextEncoder(),parts=[],central=[];let offset=0;for(const file of files){const name=enc.encode(file.name),data=new Uint8Array(await file.blob.arrayBuffer()),crc=crc32(data),[local,v]=bytesHeader(30);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);parts.push(local,name,data);const[c,d]=bytesHeader(46);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);central.push(c,name);offset+=30+name.length+data.length}
 const cs=central.reduce((n,a)=>n+a.length,0),[end,e]=bytesHeader(22);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'})}
async function savePackage(action){if(state.busy)return;state.busy=true;const old=action.innerHTML;action.setAttribute('aria-disabled','true');action.textContent='正在准备保存文件…';try{const report=await renderReport(),quick=await assetBlob(guideFiles[0]),modes=await assetBlob(guideFiles[1]);state.downloads={report,quick,modes};const zip=await makeZip([{name:'体重管理评分与专属方案.png',blob:report},{name:'快速使用攻略.jpg',blob:quick},{name:'产品结构与模式说明.jpg',blob:modes}]);downloadBlob(zip,'VD-FIT-专属方案与使用指南.zip');toast('文件已准备好，请在浏览器下载中查看')}catch(e){console.error('export failed',e);toast('保存文件暂时未生成，请重试；当前报告已保留')}finally{state.busy=false;action.removeAttribute('aria-disabled');action.innerHTML=old}}
syncReport();showRoute('home');

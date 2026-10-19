const window={TWO_US_CONFIG:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test-public',SHARED_ID:'our-shared-space'}};
const elements=new Map();
const $=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',hidden:false,replaceChildren(){},setAttribute(){},append(){}});return elements.get(selector)};
const document={body:{classList:{toggle(){}}}};
let records=[],map=null,renderCount=0;
const closeModal=()=>{},render=()=>renderCount++;
const subs={film:['电影','电视剧'],game:['Steam'],travel:['国内'],music:['单曲'],intimacy:['亲密记录']};
const parseGenres=v=>Array.isArray(v)?v:[];
const hasProgress=r=>r.cat==='game'||r.cat==='film'&&r.sub==='电视剧';
function assert(value,message){if(!value)throw Error(message)}

// 轻量 DOM 替身用于验证个人资料渲染，不代替真实浏览器可访问性测试。
document.createElement=()=>({textContent:'',append(){},addEventListener(){},remove(){}});

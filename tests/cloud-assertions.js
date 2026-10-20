(async()=>{
 for(const value of ['', ' ', null,undefined,true,Infinity,'oops',91])assert(coordinate(value,90)===undefined,'invalid latitude '+value);
 assert(coordinate(0,90)===0&&coordinate('0',90)===0,'real zero retained');assert(coordinate('-32.5',90)===-32.5,'negative retained');
 const row=v=>({id:'real-id',content:JSON.stringify(v)});
 let item=decodeRow(row({cat:'travel',sub:'国内',lat:'',lng:null,score:99,progress:130,watchedEpisodes:4}));
 assert(!('lat' in item)&&!('lng' in item),'blank coordinates omitted');assert(item.score===10&&!('progress' in item),'non-progress fields cleaned');
 item=decodeRow(row({cat:'game',sub:'Steam',progress:130,score:-5,playHours:-10,watchedEpisodes:2.8,currentEpisode:-1}));
 assert(!('progress' in item)&&item.score===0&&item.playHours===0&&!('watchedEpisodes' in item),'numeric clamping');
 item=decodeRow(row({cat:'film',sub:'电视剧',totalEpisodes:24,watchedEpisodes:6,currentEpisode:7}));assert(item.currentEpisode===7,'TV progress retained');
 assert(friendlyError({message:'记录已被修改，请重新编辑'}).includes('刷新'),'conflict actionable');
 let oversize=false;try{validCoverSize({image:'data:'+ 'a'.repeat(300001)})}catch{oversize=true}assert(oversize,'oversized base64 blocked');
 item=decodeRow(row({cat:'game',image:'data:image/jpeg;base64,'+'a'.repeat(300001)}));assert(item.image==='','legacy oversized cover hidden');
 const calls=[];let result={data:[],error:null};
 const query={select(...a){calls.push(['select',...a]);return this},eq(...a){calls.push(['eq',...a]);return this},order(...a){calls.push(['order',...a]);return this},range(){return Promise.resolve(result)},insert(data){calls.push(['insert',data]);return Promise.resolve({error:null})},delete(){return this},then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}};
 cloud={from(){return query},rpc(name,args){calls.push(['rpc',name,args]);return Promise.resolve({error:null})}};
 let denied=false;try{await saveSharedItem({title:'test',cat:'film',sub:'电影'},null,null)}catch{denied=true}assert(denied,'unsigned write denied');
 cloudUser={id:'user-one'};
 await saveSharedItem({title:'test',cat:'travel',sub:'国内',lat:'',lng:''},null,null);
 const payload=calls.find(x=>x[0]==='insert')[1];assert(payload.shared_id==='our-shared-space'&&!('created_by' in payload),'insert scoped and creator automatic');assert(!('lat' in JSON.parse(payload.content)),'submit omits empty latitude');
 await saveSharedItem({title:'edit',cat:'game',sub:'Steam'},'id','expected');assert(calls.some(x=>x[0]==='rpc'&&x[2].p_expected_content==='expected'),'RPC optimistic check');
 result={data:[row({cat:'game',sub:'Steam',title:'test'})],error:null};await loadSharedItems();assert(records.length===1&&!listLoading,'load completes');
 let resolveRange;query.range=()=>new Promise(resolve=>resolveRange=resolve);const pending=loadSharedItems();assert(listLoading,'loading state on');cloudEpoch++;cloudUser=null;records=[];resolveRange(result);await pending;assert(records.length===0,'late logout response ignored');
 cloudUser={id:'person-one'};const subscriptions=[];const channel={on(type,filter,callback){subscriptions.push(filter);return this},subscribe(){return this}};
 cloud={rpc:async()=>({data:[{user_id:'person-one',nickname:'小一',avatar:'data:image/jpeg;base64,YQ=='},{user_id:'person-two',nickname:'小二',avatar:'javascript:bad'}],error:null}),channel:()=>channel};
 await loadPeople();assert(sharedPeople.length===2&&sharedPeople[0].nickname==='小一'&&sharedPeople[1].avatar==='','shared profiles rendered safely');assert(subscriptions.some(x=>x.event==='UPDATE'&&x.filter==='shared_id=eq.our-shared-space'),'profile realtime scoped update');
 let resolvePeople;cloud.rpc=()=>new Promise(resolve=>resolvePeople=resolve);const peoplePending=loadPeople();cloudEpoch++;cloudUser=null;sharedPeople=[];resolvePeople({data:[{user_id:'old',nickname:'old'}],error:null});await peoplePending;assert(sharedPeople.length===0,'profile load cannot restore logged out identity');
 print('PASS: profiles load, realtime and logout race');
 print('PASS: coordinates, clamping, stale progress cleanup, conflict text, cover limit, insert/RPC, loading and logout race');
})().catch(error=>{print(String(error));quit(1)});

// 个人资料：安全头像、成员显示顺序、实时重载和会话切换。
(async()=>{
 assert(profileAvatar('javascript:alert(1)')==='','avatar protocol');
 assert(profileAvatar('data:image/jpeg;base64,'+'a'.repeat(60000))==='','avatar size limit');
 assert(profileAvatar('data:image/jpeg;base64,YQ==')!=='','compressed avatar accepted');
 assert(profileName({nickname:''},0)==='A'&&profileName({nickname:'  昵称  '},1)==='昵称','profile name fallback');
 print('PASS: profile avatar validation and nickname fallback');
})().catch(error=>{print(String(error));quit(1)});

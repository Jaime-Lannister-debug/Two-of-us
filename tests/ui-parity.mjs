import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestApp} from './helpers/app.mjs';
import {cases,capture,seed,cssDigest} from './helpers/parity.mjs';
// 界面摘要固定时区，避免本机与 GitHub UTC runner 的时间文案不同。
const originalTimeZone=process.env.TZ;process.env.TZ='Asia/Shanghai';
const nativeDate=Date;globalThis.Date=class extends nativeDate{constructor(...args){super(...(args.length?args:['2026-10-20T04:00:00Z']))}static now(){return new nativeDate('2026-10-20T04:00:00Z').getTime()}};
const env=await createTestApp();
try{seed(env.app,env.core);const expected=JSON.parse(await readFile(new URL('./fixtures/ui-contracts.json',import.meta.url),'utf8'));assert.equal(await cssDigest(),expected.cssHash,'样式规则和顺序必须保持一致');for(const entry of cases)assert.equal(capture(env.app,env.w.document,entry),expected.hashes[entry.name],'重构前后 DOM 不一致：'+entry.name);console.log('PASS: '+cases.length+' DOM contracts: 19 preserved interfaces and the reviewed mood composer update');}
finally{globalThis.Date=nativeDate;if(originalTimeZone===undefined)delete process.env.TZ;else process.env.TZ=originalTimeZone;env.cleanup()}

import assert from 'node:assert/strict';
import {parseMoney,decimal,money,equalShares,change,monthRange} from '../src/ledger/money.js';
assert.equal(parseMoney('0.01'),'1');assert.equal(parseMoney('0001.2'),'120');assert.equal(parseMoney('10000000000.00'),'1000000000000');assert.equal(parseMoney('0',true),'0');
for(const bad of ['0','-1','1.001','NaN','Infinity','1e3','1,000','10000000000.01','.1',''])assert.throws(()=>parseMoney(bad));
assert.equal(decimal('9007199254740993'),'90071992547409.93');assert.equal(money('-101'),'¥-1.01');
const shares=equalShares('1001',[{user_id:'b'},{user_id:'a'}]);assert.deepEqual(shares,[{user_id:'a',amount_minor:'501'},{user_id:'b',amount_minor:'500'}]);
assert.equal(change('1','0'),'上月为零，本月新增');assert.equal(change('0','0'),'与上月持平');assert.equal(change('125','100'),'+25.00%');assert.equal(change('1','3'),'-66.67%');
assert.deepEqual(monthRange('2026-12'),{from:'2026-12-01',to:'2027-01-01'});
console.log('PASS: exact cent parsing/formatting, invalid amounts, stable odd-cent split, ratios and year boundaries');

import test from 'node:test';import assert from 'node:assert/strict';import {chartDays,completeSegments,comparisonScale} from './rdCharts.js';
test('missing dates and nutrients stay null; partial zero is a known point, never a complete segment',()=>{
 const daily=[{date:'2026-10-15',nutrients:{sodium:{knownCount:1,itemCount:1,knownSubtotal:0,complete:true}}},{date:'2026-10-17',nutrients:{sodium:{knownCount:1,itemCount:2,knownSubtotal:0,complete:false}}},{date:'2026-10-18',nutrients:{sodium:{knownCount:0,itemCount:1,knownSubtotal:0,complete:false}}}];
 const points=chartDays(daily,'2026-10-15','2026-10-19','sodium');assert.deepEqual(points.map(p=>p.value),[0,null,0,null,null]);assert.equal(completeSegments(points).length,1);assert.equal(completeSegments(points)[0].length,1);
 assert.ok(comparisonScale(150,100)>150);assert.ok(comparisonScale(0,100)>100);assert.ok(comparisonScale(null,0)>0);
 assert.deepEqual(chartDays(daily,'2026-10-19','2026-10-15','sodium'),[]);
});

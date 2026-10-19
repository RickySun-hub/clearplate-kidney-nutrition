import {useState} from 'react';
import {chartDays,completeSegments,comparisonScale} from '../utils/rdCharts.js';
import {formatAmount} from '../utils/nutrition.js';
export default function RDCharts({daily,nutrients,start,end,totals}){
 const [choice,setChoice]=useState('sodium');const metric=nutrients.find(n=>n.key===choice)||nutrients[0];
 if(!metric)return <p>Choose a nutrient to show charts.</p>;
 const points=chartDays(daily,start,end,metric.key),known=points.filter(p=>p.value!==null),latest=daily.at(-1);
 const target=latest?.nutrients[metric.key]?.target||{};
 const ceiling=comparisonScale(Math.max(0,...known.map(p=>p.value)),target.max);
 const x=p=>42+(points.indexOf(p)/Math.max(1,points.length-1))*490,y=value=>170-value/ceiling*130;
 const limits=nutrients.filter(n=>latest?.nutrients[n.key]?.target.max!=null);
 return <section className="rd-visuals" aria-label="Nutrition charts">
 <div className="rd-chart-trend"><header><div><h3>Daily nutrition</h3><p>{points[0]?.date} – {points.at(-1)?.date} · {metric.unit}/day</p></div><label>Nutrient<select aria-label="Nutrient" value={metric.key} onChange={e=>setChoice(e.target.value)}>{nutrients.map(n=><option key={n.key} value={n.key}>{n.label}</option>)}</select></label></header>
 {points.length&&known.length?<><svg className="rd-trend-svg" viewBox="0 0 560 215" role="img" aria-label={`${metric.label} by day. Filled points: complete nutrition data. Hollow points: known amounts only. Missing days have no value.`}>
 {[0,ceiling/2,ceiling].map(v=><g key={v}><line x1="42" x2="532" y1={y(v)} y2={y(v)} stroke="#e1e7ed"/><text x="34" y={y(v)+4} textAnchor="end">{formatAmount(v,0)}</text></g>)}
 {target.max!=null&&<g><line x1="42" x2="532" y1={y(target.max)} y2={y(target.max)} stroke="#794600" strokeDasharray="6 4"/><text x="532" y={y(target.max)-7} textAnchor="end" fill="#794600">Saved limit {target.max}</text></g>}
 {(known.length>=4?completeSegments(points):[]).filter(s=>s.length>1).map((s,i)=><polyline key={i} fill="none" stroke="#174b89" strokeWidth="2.5" points={s.map(p=>`${x(p)},${y(p.value)}`).join(' ')}/>)}
 {points.map((p,i)=><g key={p.date}>{p.value!==null?<circle cx={x(p)} cy={y(p.value)} r="5" stroke="#174b89" strokeWidth="2" fill={p.complete?'#174b89':'white'}><title>{p.date}: {p.value} {metric.unit}; {p.known}/{p.count} items known</title></circle>:<text x={x(p)} y="171" textAnchor="middle">?</text>}{(points.length<=7||i===0||i===points.length-1)&&<text x={x(p)} y="200" textAnchor="middle">{p.date.slice(5)}</text>}</g>)}
 </svg><div className="rd-chart-legend"><span>● Complete data</span><span>○ Known amount only</span><span>? Missing data</span></div></>:<div className="rd-chart-empty">No known {metric.label.toLowerCase()} amounts in these dates.</div>}
 {known.length>0&&known.length<4&&<p className="rd-chart-note">Few recorded days — points only where data exists; no trend conclusion.</p>}
 <details className="rd-chart-data"><summary>Chart values{points.length===31?' · latest 31 selected dates':''}</summary><div className="rd-table-scroll" tabIndex="0" role="region" aria-label="Daily chart values"><table><thead><tr><th>Date</th><th>{metric.label} ({metric.unit})</th><th>Data coverage</th></tr></thead><tbody>{points.map(p=><tr key={p.date}><td>{p.date}</td><td>{p.value===null?'Unknown':formatAmount(p.value,2)}</td><td>{p.known}/{p.count} items known{!p.complete?' · Full total unknown':''}</td></tr>)}</tbody></table></div></details>
 </div>
 <div className="rd-chart-comparison"><header><h3>Amounts & upper limits</h3><p>{latest?.date||'No recorded day'} · recorded foods</p></header><p className="rd-chart-note">A limit is a ceiling, not an amount to reach.</p>
 {limits.length?limits.map(n=>{const v=latest.nutrients[n.key],scale=comparisonScale(v.knownSubtotal,v.target.max);return <article key={n.key}><div className="rd-bar-label"><strong>{n.label}</strong><span>{v.knownCount?formatAmount(v.knownSubtotal,2):'Unknown'} {n.unit}</span></div><div className="rd-limit-bar" role="img" aria-label={`${n.label}: ${v.knownCount?v.knownSubtotal:'Unknown'} ${n.unit}; saved upper limit ${v.target.max}; ${v.status}`}><span className={`rd-bar-amount ${v.complete?'':'is-partial'}`} style={{width:v.knownCount?`${v.knownSubtotal/scale*100}%`:'0%'}}/><span className="rd-limit-tick" style={{left:`${v.target.max/scale*100}%`}}/></div><div className="rd-bar-caption"><span>{v.status}</span><span>Limit {v.target.max} {n.unit}</span></div>{!v.complete&&<small>{v.dataStatus} · {v.knownCount}/{v.itemCount} items known</small>}</article>;}):<p className="rd-chart-empty">No saved upper limits for these nutrients.</p>}
 </div>
 <div className="rd-chart-coverage"><header><h3>Nutrition data coverage</h3><p>Selected dates · items with known values</p></header>{nutrients.map(n=>{const v=totals[n.key];return <div className="rd-coverage-row" key={n.key}><span>{n.label}</span><div className="rd-coverage-track" aria-hidden="true"><span style={{width:v.itemCount?`${v.knownCount/v.itemCount*100}%`:'0%'}}/></div><strong>{v.knownCount}/{v.itemCount}</strong></div>;})}<small>Coverage describes data, not intake adequacy.</small></div>
 </section>;
}

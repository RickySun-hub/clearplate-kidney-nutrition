import {useEffect,useState} from 'react';
import { foodReviewUpdateCount } from '../utils/foodReviewUpdates.js';
import './workspace-navigation.css';
export default function FoodReviewNotice({client,onOpen}){
 const [status,setStatus]=useState(null),[error,setError]=useState(false);
 useEffect(()=>{
  let alive=true,running=false;
  setStatus(null);setError(false);
  async function refresh(){if(running||document.hidden)return;running=true;try{const next=await client.foodReview('status');if(alive){setStatus(next);setError(false);}}catch{if(alive){setStatus(null);setError(true);}}finally{running=false;}}
  refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);window.addEventListener('food-review-updated',refresh);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('food-review-updated',refresh);};
 },[client]);
 const count=foodReviewUpdateCount(status);
 return <aside className="food-review-entry" aria-label="Food review updates">
  <button type="button" className="food-review-entry-link" onClick={onOpen}>Food submissions{count>0&&<span className="food-review-count" aria-label={`${count} food review updates`}>{count}</span>}</button>
  <details className="food-review-entry-details"><summary>{error?'Updates unavailable':'Updates'}</summary><p role="status">{error?'Review updates unavailable. Open submissions to retry.':status?`${status.needsInfo||0} of your submissions need more information · ${status.reviewed||0} reviewed submissions.${status.reviewer?` ${status.pending||0} awaiting review.`:''} Updated every minute while this page is visible.`:'Checking food review updates…'}</p></details>
 </aside>;
}

interface Storage {removeItem(key:string):Promise<void>}
export async function clearAccountLocalData(storage:Storage,owner:string,completedDeletion=false) {
  const keys=[`@pogos_locations:${owner}`,'@pogos_saved_locations'];
  // Ordinary logout must preserve financial recovery identities. A confirmed
  // deletion has already reconciled outstanding work and may remove them.
  if(completedDeletion)keys.push(`@pogos_pending_cash_order:${owner}`,`@pogos_pending_staff_command:${owner}`,`@pogos_pending_reward_command:${owner}`,`@pogos_pending_branch_command:${owner}`,`@pogos_pending_finance_command:${owner}`);
  const results=await Promise.allSettled(keys.map(key=>storage.removeItem(key)));
  if(results.some(result=>result.status==='rejected'))throw new Error('Account cache cleanup could not be confirmed.');
}

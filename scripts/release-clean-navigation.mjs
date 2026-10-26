import assert from 'node:assert/strict';
export const commandTimeoutMs = method => method === 'Page.navigate' ? 90000 : 30000;
export async function measuredNavigation(send, url, now = Date.now) {
 const startedAt = now();
 try {
  const acknowledgement = await send('Page.navigate', {url});
  if(acknowledgement.errorText)throw new Error('Navigation rejected: '+acknowledgement.errorText);
  const acknowledgedAt=now();
  return {startedAt,acknowledgedAt,acknowledgementMs:acknowledgedAt-startedAt,deadlineMs:commandTimeoutMs('Page.navigate'),frameId:acknowledgement.frameId,loaderId:acknowledgement.loaderId};
 }catch(error){throw new Error('NAVIGATION_FAILED: '+error.message,{cause:error});}
}
export function navigationPerformance(entry) {
 assert(entry&&Number.isFinite(entry.requestStart)&&entry.requestStart>=0&&Number.isFinite(entry.responseStart)&&entry.responseStart>=entry.requestStart&&Number.isFinite(entry.responseEnd)&&entry.responseEnd>=entry.responseStart);
 return {requestStart:entry.requestStart,responseStart:entry.responseStart,responseEnd:entry.responseEnd,ttfbMs:entry.responseStart-entry.requestStart,responseDownloadMs:entry.responseEnd-entry.responseStart,domInteractive:entry.domInteractive,domContentLoadedEventEnd:entry.domContentLoadedEventEnd,loadEventEnd:entry.loadEventEnd};
}

export function readinessTimeline(semanticReadyAt,timeOrigin,responseEnd){assert(Number.isFinite(semanticReadyAt)&&Number.isFinite(timeOrigin)&&timeOrigin>0&&Number.isFinite(responseEnd)&&responseEnd>0);const documentResponseEndAt=timeOrigin+responseEnd;return{semanticReadyAt,documentResponseEndAt,semanticReadyPrecededResponseEnd:semanticReadyAt<documentResponseEndAt,afterDocumentResponseEndMs:semanticReadyAt>=documentResponseEndAt?semanticReadyAt-documentResponseEndAt:null,beforeDocumentResponseEndMs:semanticReadyAt<documentResponseEndAt?documentResponseEndAt-semanticReadyAt:null};}
